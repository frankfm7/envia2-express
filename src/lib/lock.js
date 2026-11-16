// Seguridad de ingreso en ESTE celular (no se guarda en la nube).
// Un interruptor (habilitada / deshabilitada) y hasta 3 métodos a la vez:
//   • pin     : código de 4 dígitos
//   • pattern : patrón de puntos
//   • bio     : huella / rostro / bloqueo del propio celular (WebAuthn)
import { sha256, biometricConfirm } from './proof';

const KEY = (uid) => `boxruta:lock:${uid}`;
const LAST = 'boxruta:lock:last-active';
export const LOCK_AFTER_MS = 60 * 1000; // se vuelve a pedir si la app estuvo en segundo plano más de 1 minuto
export const METHOD_LABEL = { pin: 'Código', pattern: 'Patrón', bio: 'Huella / bloqueo del celular' };

function read(uid) {
  try {
    const c = JSON.parse(localStorage.getItem(KEY(uid)));
    if (!c) return null;
    // formato anterior { type, hash }
    if (c.type && !c.methods) return { enabled: true, methods: { [c.type]: c.type === 'bio' ? { on: true } : { hash: c.hash } } };
    return c;
  } catch {
    return null;
  }
}
const write = (uid, c) => localStorage.setItem(KEY(uid), JSON.stringify(c));

/** Configuración activa (o null si está deshabilitada / sin métodos) */
export function getLock(uid) {
  const c = read(uid);
  if (!c?.enabled || !c.methods || !Object.keys(c.methods).length) return null;
  return c;
}
export const lockMethods = (uid) => Object.keys(getLock(uid)?.methods || {});
/** Método principal para la pantalla de entrada: patrón > código > huella */
export const primaryMethod = (uid) => ['pattern', 'pin', 'bio'].find((m) => lockMethods(uid).includes(m)) || null;

const hashSecret = (uid, method, secret) => sha256(`envia2|${uid}|${method}|${secret}`);

export async function setLockMethod(uid, method, secret) {
  const c = read(uid) || { enabled: true, methods: {} };
  c.enabled = true;
  c.methods = { ...(c.methods || {}), [method]: method === 'bio' ? { on: true } : { hash: await hashSecret(uid, method, secret) } };
  write(uid, c);
}
export function removeLockMethod(uid, method) {
  const c = read(uid);
  if (!c) return;
  delete c.methods[method];
  if (!Object.keys(c.methods).length) c.enabled = false;
  write(uid, c);
}
/** Deshabilitar = se quitan todos los métodos */
export function clearLock(uid) {
  localStorage.removeItem(KEY(uid));
}

export async function checkSecret(uid, method, secret) {
  const m = getLock(uid)?.methods?.[method];
  if (!m?.hash) return false;
  if (m.hash === (await hashSecret(uid, method, secret))) return true;
  // compatibilidad con el formato anterior
  return m.hash === (await sha256(`envia2|${uid}|${secret}`));
}

export async function unlockWithBiometric(user) {
  const r = await biometricConfirm(user, `desbloqueo|${Date.now()}`);
  return !!r?.verified;
}

export const markActive = () => {
  try {
    sessionStorage.setItem(LAST, String(Date.now()));
  } catch {
    /* sin almacenamiento */
  }
};
export const lastActive = () => {
  try {
    return Number(sessionStorage.getItem(LAST)) || 0;
  } catch {
    return 0;
  }
};
