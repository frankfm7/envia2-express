// Evidencias de entrega: compresión de fotos, sello SHA-256 y biometría (huella/rostro).

/** Reduce una foto de la cámara a JPEG ~1000px para guardarla y enviarla rápido. */
export function compressImage(file, max = 900, quality = 0.62) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      // Marca de agua con fecha/hora para que la foto tenga valor como evidencia.
      const stamp = new Date().toLocaleString('es');
      ctx.font = `${Math.max(14, c.width / 40)}px sans-serif`;
      const w = ctx.measureText(stamp).width + 16;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(c.width - w - 8, c.height - 36, w, 28);
      ctx.fillStyle = '#fff';
      ctx.fillText(stamp, c.width - w, c.height - 16);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** JSON con llaves ordenadas: el mismo contenido siempre produce el mismo sello. */
export function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object')
    return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}

/** Sello de integridad: si alguien altera la firma, las fotos o los datos, el sello ya no coincide. */
export function sealPayload(shipment, proof, evidence) {
  const { hash, ...rest } = proof;
  return stable({
    id: shipment.id,
    code: shipment.code,
    driverId: shipment.driverId ?? null,
    proof: rest,
    photo: evidence?.photo ?? null,
    signature: evidence?.signature ?? null,
    pickupPhoto: evidence?.pickupPhoto ?? null,
  });
}

export async function computeSeal(shipment, proof, evidence) {
  return sha256(sealPayload(shipment, proof, evidence));
}

export async function verifySeal(shipment, evidence) {
  if (!shipment.proof?.hash) return false;
  return (await computeSeal(shipment, shipment.proof, evidence)) === shipment.proof.hash;
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function biometricAvailable() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/**
 * Confirmación con huella digital / Face ID del propio teléfono (WebAuthn).
 * El navegador NUNCA entrega la imagen de la huella (por seguridad); el teléfono
 * verifica que es su dueño y nos devuelve una firma criptográfica que guardamos
 * como prueba. Requiere HTTPS (o localhost).
 *
 * @param user  { id, name }
 * @param challengeText  texto que queda firmado (ej. código del envío + hora)
 */
export async function biometricConfirm(user, challengeText) {
  const challenge = new TextEncoder().encode(challengeText);
  const credKey = `boxruta:cred:${user.id}`;
  let credId = localStorage.getItem(credKey);

  if (!credId) {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Envia2 Express' },
        user: { id: new TextEncoder().encode(user.id), name: user.name, displayName: user.name },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
      },
    });
    credId = b64(cred.rawId);
    localStorage.setItem(credKey, credId);
    return { method: 'webauthn-registro', credentialId: credId, ts: Date.now(), verified: true };
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: fromB64(credId) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return {
    method: 'webauthn',
    credentialId: credId,
    signature: b64(assertion.response.signature).slice(0, 120),
    ts: Date.now(),
    verified: true,
  };
}
