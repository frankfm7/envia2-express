// ─────────────────────────────────────────────────────────────────────────────
// TARIFARIO FINAL Envia2 Express (Bolivia, en Bs). Para cambiar precios, edita
// solo este archivo. La distancia SIEMPRE es la de la ruta por calles.
// ─────────────────────────────────────────────────────────────────────────────

export const SERVICES = {
  simple: { label: 'Envío simple', desc: 'Recoger en A y entregar en B', icon: '📦' },
  errand: { label: 'Mandado con compra / encargo', desc: 'Compramos por ti y te lo llevamos', icon: '🛍️' },
};

/** Tramos por distancia de RUTA. `upTo` en km (inclusive). */
export const TIERS = [
  { upTo: 2.0, name: 'Hasta 2 km', zone: 'Centro y zonas cercanas', simple: 8, errand: 10 },
  { upTo: 3.5, name: 'De 2,1 a 3,5 km', zone: '', simple: 10, errand: 14 },
  { upTo: 4.5, name: 'De 3,6 a 4,5 km', zone: '', simple: 12, errand: 18 },
  { upTo: 5.5, name: 'De 4,6 a 5,5 km', zone: '', simple: 15, errand: 22 },
  { upTo: 6.5, name: 'De 5,6 a 6,5 km', zone: '', simple: 18, errand: 25 },
  { upTo: 7.5, name: 'De 6,6 a 7,5 km', zone: 'Periferia cercana', simple: 22, errand: 28 },
];
/** Más de 7,5 km: base propia + Bs 2,50 por cada km extra (contado desde el km 7,5) */
export const LONG = { from: 7.5, name: 'Más de 7,5 km', zone: 'Larga distancia', base: { simple: 25, errand: 30 }, perKm: { simple: 2.5, errand: 2.5 } };

export const RULES = {
  freeWaitMin: 10, // tolerancia gratis por parada (recojo, compra o entrega)
  waitBlockMin: 10, // cada bloque adicional…
  waitBlockPrice: 2, // …cuesta Bs 2
  surcharge: 3, // nocturno o clima adverso (no se suman entre sí)
  nightFrom: 21, // desde las 21:00
  nightTo: 6, // hasta las 06:00
  heavyKg: 10, // bultos de más de 10 kg…
  heavySurcharge: 3, // …+Bs 3
  maxGoodsValue: 500, // valor transportado con tarifa normal; más → se cotiza aparte
  maxCash: 200, // no se transporta efectivo mayor a Bs 200
  advancePct: 0.5, // mandados: el cliente adelanta por QR mínimo el 50 % de la compra…
  // …y ese adelanto nunca es menor al costo del envío
  storagePerDay: 3, // no entrega: depósito en oficina por día
  redelivery: 5, // reenvío
  maxPinTries: 5,
};

/**
 * GANANCIA del repartidor (solo la ven repartidores y administrador).
 * Ganancia = precio − comisión de la empresa − costo de gasolina/desgaste por km de ruta.
 * Ajusta estos dos valores a tu realidad.
 */
export const EARNINGS = {
  commissionPct: 0, // % que se queda la empresa (0 si tú mismo repartes)
  costPerKm: 0.5, // Bs por km de ruta (gasolina + desgaste, incluye volver)
};
export function driverEarning(price, km) {
  const commission = Math.round(price * EARNINGS.commissionPct) / 100 || 0;
  const cost = Math.round((km || 0) * EARNINGS.costPerKm * 10) / 10;
  return { commission, cost, net: Math.max(0, Math.round((price - commission - cost) * 10) / 10) };
}

/** Cuando solo se conoce la distancia en LÍNEA RECTA, por las calles suele ser 40–50 % más. */
export const STRAIGHT_TO_ROUTE = { min: 1.4, max: 1.5, est: 1.45 };

const round1 = (n) => Math.round(n * 10) / 10;

export const isNight = (ts = Date.now()) => {
  const h = new Date(ts).getHours();
  return h >= RULES.nightFrom || h < RULES.nightTo;
};

/** Cobro por espera de UNA parada (minutos totales esperados en esa parada) */
export function waitCharge(minutes) {
  const extra = Math.max(0, Math.ceil(minutes || 0) - RULES.freeWaitMin);
  const blocks = Math.ceil(extra / RULES.waitBlockMin);
  return { blocks, amount: blocks * RULES.waitBlockPrice };
}

/** Mandados: cuánto debe adelantar el cliente por QR */
export function errandAdvance(purchase, shipping) {
  const p = Number(purchase) || 0;
  return Math.max(Math.ceil(p * RULES.advancePct), Number(shipping) || 0);
}

/**
 * Calcula la tarifa.
 * @param km        distancia de la ruta en km
 * @param service   'simple' | 'errand'
 * @param waits     minutos esperados por parada, ej. [12, 25]
 * @param night     de 21:00 a 06:00
 * @param weather   lluvia / granizo
 * @param weightKg  peso del bulto (más de 10 kg = recargo)
 */
export function computeTariff({ km, service = 'simple', waits = [], night = false, weather = false, weightKg = 0 }) {
  const d = round1(Math.max(0, km || 0));
  const tierIdx = TIERS.findIndex((t) => d <= t.upTo);
  let base;
  let extraKm = 0;
  let extraCharge = 0;
  let tier;
  if (tierIdx >= 0) {
    tier = TIERS[tierIdx];
    base = tier[service];
  } else {
    tier = LONG;
    base = LONG.base[service];
    extraKm = Math.ceil(round1(d - LONG.from)); // ej. 9 km → 1,5 km extra → 2 km
    extraCharge = extraKm * LONG.perKm[service];
  }
  const waitLines = waits.map((m) => ({ minutes: Math.round(m || 0), ...waitCharge(m) })).filter((w) => w.amount > 0);
  const waitTotal = waitLines.reduce((a, w) => a + w.amount, 0);
  const surcharge = night || weather ? RULES.surcharge : 0;
  const heavy = Number(weightKg) > RULES.heavyKg ? RULES.heavySurcharge : 0;
  const total = base + extraCharge + waitTotal + surcharge + heavy;
  const lines = [{ label: `${SERVICES[service].label} · ${tier.name}`, amount: base }];
  if (extraKm) lines.push({ label: `${extraKm} km extra × Bs ${String(LONG.perKm[service]).replace('.', ',')}`, amount: extraCharge });
  waitLines.forEach((w) => lines.push({ label: `Espera ${w.minutes} min (${w.blocks} × 10 min extra)`, amount: w.amount }));
  if (surcharge) lines.push({ label: `Recargo ${night && weather ? 'nocturno / clima' : night ? 'nocturno (desde 21:00)' : 'por lluvia / granizo'}`, amount: surcharge });
  if (heavy) lines.push({ label: `Bulto de más de ${RULES.heavyKg} kg`, amount: heavy });
  return { km: d, service, tier, base, extraKm, extraCharge, waitTotal, surcharge, heavy, total, lines };
}

const bs = (n) => `Bs ${String(n).replace('.', ',')}`;

/** Texto del tarifario para WhatsApp Business */
export function tariffMessage(business = 'Envia2 Express') {
  return (
    `🛵 *${business} — Tarifas*\n_Distancia medida por la ruta real (Google Maps), no en línea recta_\n\n` +
    `📦 *Envío simple* (A → B)\n` +
    TIERS.map((t) => `• ${t.name}: ${bs(t.simple)}`).join('\n') +
    `\n• ${LONG.name}: ${bs(LONG.base.simple)} + ${bs(LONG.perKm.simple)} por km extra\n\n` +
    `🛍️ *Mandado con compra / encargo*\n` +
    TIERS.map((t) => `• ${t.name}: ${bs(t.errand)}`).join('\n') +
    `\n• ${LONG.name}: ${bs(LONG.base.errand)} + ${bs(LONG.perKm.errand)} por km extra\n\n` +
    `🌙 Desde las 21:00 o con lluvia/granizo: +${bs(RULES.surcharge)}\n` +
    `⏱️ Espera: ${RULES.freeWaitMin} min gratis, luego ${bs(RULES.waitBlockPrice)} cada 10 min\n` +
    `📍 Para cotizar envíanos las 2 ubicaciones (recojo y entrega).`
  );
}

/** Las 8 condiciones del servicio */
export const CONDITIONS = [
  ['📏 Cotización exacta', 'El precio se confirma midiendo la distancia real en Google Maps con ambos pines de ubicación (recojo y entrega).'],
  ['🛍️ Compras y encargos', `El repartidor NO pone su dinero. El cliente adelanta por QR mínimo el ${RULES.advancePct * 100} % de la compra (y nunca menos que el costo del envío). El saldo se paga contra entrega.`],
  ['💼 Tope de valor', `Hasta ${bs(RULES.maxGoodsValue)} de mercancía entra en la tarifa normal. Montos mayores se cotizan aparte (acuerdo previo).`],
  ['🏢 No entrega', `Si el destinatario no contesta, no está o no hay quien reciba, el pedido se deja en oficina con un cargo de ${bs(RULES.storagePerDay)} por día. El reenvío cuesta ${bs(RULES.redelivery)}.`],
  ['📸 Reclamos', 'Se hacen en el momento de la entrega (todo queda respaldado con foto y firma). Después, la empresa no se hace responsable por faltantes o daños.'],
  ['🔐 Seguridad', `El PIN es obligatorio. Sin el PIN correcto no se entrega (máximo ${RULES.maxPinTries} intentos).`],
  ['⚖️ Restricciones', `Bultos de hasta ${RULES.heavyKg} kg sin recargo (más: +${bs(RULES.heavySurcharge)}). No se transporta efectivo mayor a ${bs(RULES.maxCash)}, documentos de valor, armas ni artículos prohibidos.`],
  ['🌙 Recargos', `Nocturno (desde las 21:00) o clima adverso: +${bs(RULES.surcharge)}. Espera: ${RULES.freeWaitMin} min gratis, luego ${bs(RULES.waitBlockPrice)} cada 10 min.`],
];

export function conditionsMessage(business = 'Envia2 Express') {
  return `⚡ *Condiciones del servicio — ${business}*\n\n` + CONDITIONS.map(([t, d], i) => `${i + 1}. *${t.replace(/^\S+\s/, '')}:* ${d}`).join('\n');
}

/** Estimación a partir de la distancia en línea recta (km) → rango de precio */
export function estimateFromStraight(straightKm, opts = {}) {
  const k = Number(straightKm) || 0;
  const route = { min: k * STRAIGHT_TO_ROUTE.min, est: k * STRAIGHT_TO_ROUTE.est, max: k * STRAIGHT_TO_ROUTE.max };
  return {
    straightKm: k,
    route,
    low: computeTariff({ ...opts, km: route.min }),
    mid: computeTariff({ ...opts, km: route.est }),
    high: computeTariff({ ...opts, km: route.max }),
  };
}
