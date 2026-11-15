// ─────────────────────────────────────────────────────────────────────────────
// OFERTAS que lanza el administrador (se guardan en Ajustes del negocio):
//  • first_today : la primera entrega del día de cada cliente (ej. 30 %)
//  • first_ever  : el primer pedido de un cliente nuevo
//  • all         : todos los pedidos durante las fechas indicadas
//  • code        : código promocional que el cliente escribe (ej. ORURO20)
// Solo se aplica UN descuento por pedido: el mayor entre la oferta y el cupón elegido.
// ─────────────────────────────────────────────────────────────────────────────

export const OFFER_TYPES = {
  first_today: 'Primera entrega del día',
  first_ever: 'Primer pedido (clientes nuevos)',
  all: 'Todos los pedidos',
  code: 'Código promocional',
};

const dayStart = (ts = Date.now()) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** ¿La oferta está vigente ahora? */
export function offerLive(o, now = Date.now()) {
  if (!o?.active) return false;
  if (o.startsAt && now < o.startsAt) return false;
  if (o.endsAt && now > o.endsAt) return false;
  if (o.days?.length && !o.days.includes(new Date(now).getDay())) return false;
  if (o.fromHour != null && o.toHour != null) {
    const h = new Date(now).getHours();
    if (h < o.fromHour || h >= o.toHour) return false;
  }
  return true;
}

/** Ofertas vigentes (para mostrar en el inicio) */
export const liveOffers = (settings) => (settings?.offers || []).filter((o) => offerLive(o));

/**
 * Mejor oferta aplicable a un pedido nuevo de `me`.
 * @param code  código promocional escrito por el cliente (opcional)
 */
export function bestOffer({ me, shipments, settings, service = 'simple', code = '' }) {
  if (!me) return null;
  const mine = shipments.filter((s) => s.clientId === me.id && !s.createdByDriver && s.status !== 'cancelled');
  const today = mine.filter((s) => s.createdAt >= dayStart());
  const usedOffer = (id) => mine.some((s) => s.offer?.id === id);
  const usedToday = (id) => today.some((s) => s.offer?.id === id);
  const c = (code || '').trim().toUpperCase();
  const candidates = liveOffers(settings).filter((o) => {
    if (o.service && o.service !== 'any' && o.service !== service) return false;
    if (o.type === 'first_today') return today.length === 0 && !usedToday(o.id);
    if (o.type === 'first_ever') return mine.length === 0;
    if (o.type === 'all') return true;
    if (o.type === 'code') return c && c === String(o.code || '').toUpperCase() && (!o.oncePerClient || !usedOffer(o.id));
    return false;
  });
  return candidates.sort((a, b) => b.pct - a.pct)[0] || null;
}

/** Validar un código (para mostrar si es correcto antes de pedir) */
export function checkCode(settings, code) {
  const c = (code || '').trim().toUpperCase();
  if (!c) return null;
  return (settings?.offers || []).find((o) => o.type === 'code' && String(o.code || '').toUpperCase() === c && offerLive(o)) || null;
}

export const offerText = (o) =>
  `${o.title || OFFER_TYPES[o.type]}: ${o.pct}% de descuento${o.type === 'code' ? ` con el código ${o.code}` : ''}${o.endsAt ? ` · hasta el ${new Date(o.endsAt).toLocaleDateString('es')}` : ''}`;
