// Genera el comprobante de entrega como IMAGEN (PNG) para enviarlo por WhatsApp.
// Funciona sin internet: se dibuja en el propio celular.
import { BUSINESS_NAME, SIZES, PAYMENT_LABEL, money, whatsappLink } from './config';
import { fmtDate } from './geo';

const loadImg = (src) =>
  new Promise((res) => {
    if (!src) return res(null);
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });

function wrap(ctx, text, maxW) {
  const words = String(text ?? '—').split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  return lines;
}

export async function renderReceipt(s, ev, sealOk, link) {
  const W = 1080;
  const P = 56;
  const p = s.proof || {};
  const [photo, sig, logo] = await Promise.all([loadImg(ev?.photo), loadImg(ev?.signature), loadImg('./icon-512.png')]);
  const deliveredAt = s.events?.find((e) => e.status === 'delivered')?.ts;

  const rows = [
    ['Guía', s.code],
    s.brand && ['Marca / pedido', `${s.brand}${s.orderNo ? ' · ' + s.orderNo : ''}`],
    ['Entregado a', `${p.receivedBy || s.recipient?.name}${p.relation ? ' (' + p.relation + ')' : ''}`],
    ['Fecha y hora', deliveredAt ? fmtDate(deliveredAt) : '—'],
    ['Dirección', s.dropoff?.address],
    ['Paquete', `${s.qty || 1} caja(s) ${SIZES[s.size]?.label || ''}`],
    (s.finalPrice ?? s.price) ? ['Envío', `${money(s.finalPrice ?? s.price)} · ${PAYMENT_LABEL[s.payment] || ''}${s.routeKm ? ` · ${String(s.routeKm).replace('.', ',')} km` : ''}`] : null,
    s.proof?.charge?.waitTotal ? ['Espera', `${money(s.proof.charge.waitTotal)} (${s.proof.charge.waitPickupMin + s.proof.charge.waitDropMin} min)`] : null,
    s.proof?.charge?.purchase ? ['Compra', money(s.proof.charge.purchase)] : null,
    s.proof?.charge ? ['Total cobrado', money(s.proof.charge.total)] : null,
    ['Repartidor', `${s.driverName || ''} ${s.plate ? '· ' + s.plate : ''}`],
    ['PIN', p.pinVerified ? 'Verificado ✔' : `Sin PIN (${p.noPinReason || '—'})`],
    ['GPS', p.pos ? `${p.pos.lat.toFixed(5)}, ${p.pos.lng.toFixed(5)}${p.distanceToDropoff != null ? ` · a ${p.distanceToDropoff} m del punto` : ''}` : '—'],
    ['Firma', p.signaturePending ? 'Pendiente' : `Firmó ${p.receivedBy || ''} en el celular del repartidor`],
    s.clientBiometric && ['Confirmación', `Huella/Face ID ✔ ${fmtDate(s.clientBiometric.ts)}`],
  ].filter(Boolean);

  // Medir alto total
  const m = document.createElement('canvas').getContext('2d');
  m.font = '30px system-ui, sans-serif';
  const rowH = rows.reduce((h, [, v]) => h + wrap(m, v, W - P * 2 - 260).length * 40 + 16, 0);
  const photoH = photo ? Math.min(620, (photo.height / photo.width) * (W - P * 2)) : 0;
  const H = 220 + rowH + (photo ? photoH + 70 : 0) + (sig ? 330 : 0) + 210 + (link ? 50 : 0);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Encabezado
  const g = ctx.createLinearGradient(0, 0, W, 180);
  g.addColorStop(0, '#0a1f5c');
  g.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 180);
  ctx.fillRect(0, 176, W, 4);
  ctx.fillStyle = '#f2c418';
  ctx.fillRect(0, 176, W, 6);
  const tx = logo ? P + 140 : P;
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect?.(P, 26, 120, 120, 18);
    ctx.clip();
    ctx.drawImage(logo, P, 26, 120, 120);
    ctx.restore();
  }
  ctx.fillStyle = '#fff';
  ctx.font = '900 52px Arial Black, system-ui, sans-serif';
  ctx.fillText(BUSINESS_NAME, tx, 88);
  ctx.font = '30px system-ui, sans-serif';
  ctx.fillStyle = '#dbeafe';
  ctx.fillText('Comprobante de entrega', tx, 134);
  ctx.textAlign = 'right';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(s.code, W - P, 84);
  ctx.textAlign = 'left';

  let y = 230;
  for (const [k, v] of rows) {
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(k, P, y);
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillStyle = '#0f172a';
    const lines = wrap(ctx, v, W - P * 2 - 260);
    lines.forEach((l, i) => ctx.fillText(l, P + 260, y + i * 40));
    y += lines.length * 40 + 16;
  }

  if (photo) {
    y += 20;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('FOTO DE LA ENTREGA', P, y);
    y += 16;
    const w = Math.min(W - P * 2, (photo.width / photo.height) * photoH);
    ctx.drawImage(photo, P, y, w, photoH);
    y += photoH + 34;
  }
  if (sig) {
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('FIRMA', P, y + 10);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(P, y + 26, W - P * 2, 260);
    const ratio = Math.min((W - P * 2 - 20) / sig.width, 240 / sig.height);
    ctx.drawImage(sig, P + 10, y + 36, sig.width * ratio, sig.height * ratio);
    y += 310;
  }

  // Sello
  y += 20;
  ctx.fillStyle = sealOk ? '#dcfce7' : '#fef3c7';
  ctx.fillRect(P, y, W - P * 2, 120);
  ctx.fillStyle = sealOk ? '#166534' : '#92400e';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(sealOk ? '✔ Evidencia íntegra (sello digital)' : '⚠ Sello pendiente de verificación', P + 20, y + 46);
  ctx.font = '20px monospace';
  ctx.fillText((p.hash || '').slice(0, 64), P + 20, y + 88);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '22px system-ui, sans-serif';
  if (link) ctx.fillText(`Verifica este comprobante en: ${link}`, P, H - 74);
  ctx.fillText(`Generado ${new Date().toLocaleString('es')}`, P, H - 30);

  return new Promise((res) => c.toBlob(res, 'image/png'));
}

/** Mensaje de WhatsApp con el enlace del comprobante (el cliente NO necesita la app). */
export const receiptMessage = (s, link) =>
  `Hola ${s.recipient?.name || ''} 👋, ${BUSINESS_NAME} entregó tu paquete ${s.code}.\n` +
  `✔ Recibió: ${s.proof?.receivedBy || s.recipient?.name}${s.proof?.ts ? ' · ' + new Date(s.proof.ts).toLocaleString('es') : ''}\n` +
  `Mira tu comprobante firmado (foto y firma) aquí:\n${link}`;

/** Envía por WhatsApp el enlace del comprobante directo al número del cliente (un toque). */
export function sendReceiptLink(s, link, phone) {
  window.open(whatsappLink(phone, receiptMessage(s, link)), '_blank');
}

/**
 * Comparte la IMAGEN del comprobante. En el celular abre "Compartir" → WhatsApp.
 * En computadora descarga la imagen y abre WhatsApp Web.
 */
export async function shareReceipt(s, ev, sealOk, phone, link) {
  const blob = await renderReceipt(s, ev, sealOk, link);
  const file = new File([blob], `comprobante-${s.code}.png`, { type: 'image/png' });
  const text = `Comprobante de entrega ${s.code} — ${BUSINESS_NAME}. Recibió: ${s.proof?.receivedBy || s.recipient?.name}.`;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: `Comprobante ${s.code}` });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  if (phone) window.open(whatsappLink(phone, text + ' (te adjunto la imagen)'), '_blank');
  return 'downloaded';
}
