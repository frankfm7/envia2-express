// ─────────────────────────────────────────────────────────────────────────────
// TARIFARIO Envia2 Express (Bolivia, en Bs). Para cambiar precios, edita solo
// este archivo. La distancia SIEMPRE es la de la ruta por calles (no línea recta).
// ─────────────────────────────────────────────────────────────────────────────

export const SERVICES = {
  simple: { label: 'Envío simple', desc: 'Recoger en A y entregar en B', icon: '📦' },
  errand: { label: 'Mandado con compra y espera', desc: 'Ej. pollo, farmacia: compramos y te lo llevamos', icon: '🛍️' },
};

/** Tramos por distancia de RUTA. `upTo` en km (inclusive). */
export const TIERS = [
  { upTo: 2.5, name: 'Hasta 2,5 km', zone: 'Centro y zonas cercanas', simple: 10, errand: 12, net: [8, 10] },
  { upTo: 4.0, name: 'De 2,6 a 4,0 km', zone: 'Distancia media', simple: 12, errand: 15, net: [9, 12] },
  { upTo: 6.0, name: 'De 4,1 a 6,0 km', zone: 'Zonas intermedias / altas', simple: 18, errand: 20, net: [14, 16] },
];
/** Más de 6 km: base del último tramo + valor por cada km extra (desde el km 6) */
export const LONG = { from: 6, name: 'Más de 6,1 km', zone: 'Periferias y largas distancias', perKm: { simple: 2, errand: 2.5 }, net: [14, null] };

export const RULES = {
  freeWaitMin: 10, // tolerancia gratis por parada (recojo, compra o entrega)
  waitBlockMin: 10, // cada bloque adicional…
  waitBlockPrice: 2, // …cuesta Bs 2
  surcharge: 3, // recargo fijo nocturno o por clima (no se suman entre sí)
  nightFrom: 21, // desde las 21:00
  nightTo: 6, // hasta las 06:00
  errandAdvanceCap: 100, // tope de dinero que el repartidor adelanta en un mandado; más que eso → pago por QR antes
};

/**
 * Cuando solo se conoce la distancia en LÍNEA RECTA (medida por el cliente en Google Maps
 * o en la app), por las calles suele ser entre 40 % y 50 % más larga.
 */
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

/**
 * Calcula la tarifa.
 * @param km           distancia de la ruta en km
 * @param service      'simple' | 'errand'
 * @param waits        minutos esperados por parada, ej. [12, 25]
 * @param night        true si es de 21:00 a 06:00
 * @param weather      true si hay lluvia / granizo
 */
export function computeTariff({ km, service = 'simple', waits = [], night = false, weather = false }) {
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
    tier = { ...LONG, name: LONG.name };
    base = TIERS[TIERS.length - 1][service];
    extraKm = Math.ceil(round1(d - LONG.from)); // el km extra empieza a contar desde el km 6 (7 km → 1 km extra)
    extraCharge = extraKm * LONG.perKm[service];
  }
  const waitLines = waits.map((m) => ({ minutes: Math.round(m || 0), ...waitCharge(m) })).filter((w) => w.amount > 0);
  const waitTotal = waitLines.reduce((a, w) => a + w.amount, 0);
  const surcharge = night || weather ? RULES.surcharge : 0;
  const total = base + extraCharge + waitTotal + surcharge;
  const lines = [{ label: `${SERVICES[service].label} · ${tier.name}`, amount: base }];
  if (extraKm) lines.push({ label: `${extraKm} km extra × Bs ${String(LONG.perKm[service]).replace('.', ',')}`, amount: extraCharge });
  waitLines.forEach((w) => lines.push({ label: `Espera ${w.minutes} min (${w.blocks} × 10 min extra)`, amount: w.amount }));
  if (surcharge) lines.push({ label: `Recargo ${night && weather ? 'nocturno / clima' : night ? 'nocturno (desde 21:00)' : 'por lluvia / granizo'}`, amount: surcharge });
  const net = tier.net || LONG.net;
  return { km: d, service, tier, base, extraKm, extraCharge, waitTotal, surcharge, total, lines, net };
}

/** Texto del tarifario para copiar en las respuestas rápidas de WhatsApp Business */
export function tariffMessage(business = 'Envia2 Express') {
  const bs = (n) => `Bs ${String(n).replace('.', ',')}`;
  return (
    `🛵 *${business} — Tarifas*\n` +
    `_Distancia medida por la ruta (no en línea recta)_\n\n` +
    `📦 *Envío simple* (A → B)\n` +
    TIERS.map((t) => `• ${t.name}: ${bs(t.simple)}`).join('\n') +
    `\n• ${LONG.name}: ${bs(TIERS[2].simple)} + ${bs(LONG.perKm.simple)} por km extra\n\n` +
    `🛍️ *Mandado con compra y espera* (pollo, farmacia…)\n` +
    TIERS.map((t) => `• ${t.name}: ${bs(t.errand)}`).join('\n') +
    `\n• ${LONG.name}: ${bs(TIERS[2].errand)} + ${bs(LONG.perKm.errand)} por km extra\n\n` +
    `⏱️ ${RULES.freeWaitMin} min de espera gratis por parada; luego ${bs(RULES.waitBlockPrice)} cada 10 min.\n` +
    `🌙 Desde las 21:00 o con lluvia/granizo: +${bs(RULES.surcharge)}.\n` +
    `📍 Para cotizar envíanos la *ubicación* de recojo y de entrega.`
  );
}

/** Condiciones del servicio (mandados y pagos) */
export function conditionsMessage(business = 'Envia2 Express') {
  return (
    `📋 *Condiciones del servicio — ${business}*\n\n` +
    `1. Para cotizar necesitamos las 2 ubicaciones (recojo y entrega). El precio se calcula por la ruta real.\n` +
    `2. Mandados con compra: adelantamos hasta *Bs ${RULES.errandAdvanceCap}*. Compras mayores se pagan antes por *QR* o se entrega el dinero al repartidor.\n` +
    `3. Al recibir pagas: costo del envío + monto de la compra (con su comprobante/ticket).\n` +
    `4. Espera: ${RULES.freeWaitMin} min gratis por parada; luego Bs ${RULES.waitBlockPrice} cada 10 min.\n` +
    `5. Recargo de Bs ${RULES.surcharge} desde las 21:00 o con lluvia/granizo.\n` +
    `6. Tu PIN de entrega es personal: si lo compartes, la empresa no se hace responsable por la pérdida del producto.`
  );
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
