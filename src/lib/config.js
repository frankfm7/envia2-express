// Ajusta aquí tu negocio: moneda, tarifas y tamaños de caja.
// Se pueden cambiar sin tocar código con variables de entorno en Vercel (ver GUIA-PUBLICAR.md).
const env = import.meta.env;
/* global __APP_VERSION__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
/** Número de entrega (ZIP): sirve para saber qué versión tiene cada celular */
export const BUILD = '4.13';
export const BUSINESS_NAME = env.VITE_BUSINESS_NAME || 'Envia2 Express';
export const CURRENCY = env.VITE_CURRENCY || 'Bs ';
// Código de país para WhatsApp: 591 Bolivia · 51 Perú · 57 Colombia · 593 Ecuador · 591 Bolivia · 52 México · 56 Chile
export const WHATSAPP_COUNTRY_CODE = env.VITE_COUNTRY_CODE || '591';

export const BRANDS = ['Yanbal', 'Ésika', "L'Bel", 'Cyzone', 'Natura', 'Avon', 'Unique', 'Otra'];
export const PAYMENT_LABEL = { cash: 'Efectivo contra entrega', transfer: 'Transferencia / QR', card: 'Tarjeta', prepaid: 'Ya pagado' };

// Franjas horarias que puede elegir la consultora/cliente
export const TIME_WINDOWS = ['08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00', '18:00–20:00'];

export const SIZES = {
  S: { label: 'Chica', desc: 'Hasta 5 kg · 30×30×30 cm', icon: '📦' },
  M: { label: 'Mediana', desc: 'Hasta 15 kg · 50×40×40 cm', icon: '📦📦' },
  L: { label: 'Grande', desc: 'Hasta 30 kg · 70×50×50 cm', icon: '🧳' },
  XL: { label: 'Extra / varias', desc: 'Más de 30 kg o varias cajas', icon: '🚚' },
};

// Las tarifas están en src/lib/tariff.js (tabla por distancia de ruta).

export const DELIVERY_RADIUS_M = 250; // distancia máxima al destino para confirmar entrega sin advertencia

export const money = (n) => `${CURRENCY}${Number(n || 0).toLocaleString('es', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function whatsappLink(phone, text = '') {
  let p = String(phone || '').replace(/\D/g, '');
  if (p && p.length <= 10) p = WHATSAPP_COUNTRY_CODE + p.replace(/^0+/, '');
  if (!p) return `https://wa.me/?text=${encodeURIComponent(text)}`;
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

// ── Mensajes de WhatsApp ────────────────────────────────────────────────────
/** Aviso legal que acompaña SIEMPRE al PIN */
export const PIN_DISCLAIMER =
  `⚠️ Dale este PIN SOLO al repartidor en el momento de recibir tu paquete. No lo compartas ni lo reenvíes: ` +
  `quien tenga el PIN puede recibir el paquete. Si lo compartes con otra persona, ${BUSINESS_NAME} no se hace responsable por la pérdida del producto.`;

/** Mensaje con el PIN de entrega (+ enlace de seguimiento opcional) */
export function pinMessage(s, { trackingLink, driverName } = {}) {
  const first = (s.recipient?.name || '').split(' ')[0];
  return (
    `Hola ${first} 👋, ${driverName ? `soy ${driverName} de ` : 'te escribe '}${BUSINESS_NAME}.\n` +
    `📦 Tu paquete ${s.code}${s.brand ? ` (${s.brand}${s.orderNo ? ' · pedido ' + s.orderNo : ''})` : ''} está en camino.\n\n` +
    `🔐 *Tu PIN de entrega: ${s.pin}*\n\n` +
    `${PIN_DISCLAIMER}` +
    (trackingLink ? `\n\n📍 Sigue tu paquete aquí: ${trackingLink}` : '')
  );
}
