// ─────────────────────────────────────────────────────────────────────────────
// PROMOCIONES Envia2 Express: puntos, tarjeta de sellos, cupones y ruleta.
// Para cambiar premios o probabilidades, edita solo este archivo.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useStore, uid } from './store';

export const PROMO = {
  pointsPerOrder: 10, // puntos por cada envío ENTREGADO
  spinCost: 50, // puntos que cuesta girar la ruleta
  stampCycle: 10, // la tarjeta de sellos se reinicia cada 10 envíos
  stamps: [
    { at: 6, pct: 50, label: 'Medio envío gratis' },
    { at: 10, pct: 100, label: 'Envío GRATIS' },
  ],
  couponDays: 60, // los cupones vencen a los 60 días
};

/**
 * Premios de la ruleta (8 casillas iguales a la vista).
 * `weight` = probabilidad relativa (no se muestra al cliente). Suma 100 → porcentaje directo.
 */
export const WHEEL = [
  { key: 'free2', label: '2 envíos\ngratis', short: '2 gratis', free: 2, weight: 2, color: '#f2c418', ink: '#0b1f5c' },
  { key: 'pct10', label: '10 %', pct: 10, weight: 18, color: '#1d4ed8', ink: '#fff' },
  { key: 'pts20', label: '+20\npuntos', points: 20, weight: 14, color: '#0b1f5c', ink: '#f2c418' },
  { key: 'pct30', label: '30 %', pct: 30, weight: 14, color: '#ffffff', ink: '#0b1f5c' },
  { key: 'free1', label: 'Envío\ngratis', free: 1, weight: 5, color: '#f2c418', ink: '#0b1f5c' },
  { key: 'none', label: 'Sigue\nintentando', weight: 30, color: '#1d4ed8', ink: '#fff' },
  { key: 'pct50', label: '50 %', pct: 50, weight: 7, color: '#0b1f5c', ink: '#f2c418' },
  { key: 'pts10', label: '+10\npuntos', points: 10, weight: 10, color: '#ffffff', ink: '#0b1f5c' },
];

const DAY = 864e5;

/** Estado de promociones del cliente, calculado a partir de sus envíos y su historial */
export function computePromo(me, shipments, rewards) {
  if (!me) return null;
  const mine = shipments.filter((s) => s.clientId === me.id && !s.createdByDriver);
  const delivered = mine.filter((s) => s.status === 'delivered').sort((a, b) => a.updatedAt - b.updatedAt);
  const myRewards = (rewards || []).filter((r) => r.userId === me.id);
  const spins = myRewards.filter((r) => r.type === 'spin');

  const earned = delivered.length * PROMO.pointsPerOrder + spins.reduce((a, r) => a + (r.prize?.points || 0), 0);
  const spent = spins.reduce((a, r) => a + (r.cost || 0), 0);
  const points = Math.max(0, earned - spent);

  // Cupones de la tarjeta de sellos (se generan solos al llegar a 6 y 10 envíos de cada ciclo)
  const coupons = [];
  delivered.forEach((s, i) => {
    const n = i + 1;
    const pos = ((n - 1) % PROMO.stampCycle) + 1;
    const cycle = Math.floor((n - 1) / PROMO.stampCycle);
    const st = PROMO.stamps.find((x) => x.at === pos);
    if (st) coupons.push({ id: `stamp-${cycle}-${st.at}`, pct: st.pct, label: st.label, source: `Tarjeta de sellos (${st.at} envíos)`, createdAt: s.updatedAt });
  });
  // Cupones ganados en la ruleta
  spins.forEach((r) => {
    if (r.prize?.pct) coupons.push({ id: r.id, pct: r.prize.pct, label: `${r.prize.pct} % de descuento`, source: 'Ruleta', createdAt: r.ts });
    for (let k = 0; k < (r.prize?.free || 0); k++) coupons.push({ id: `${r.id}-${k}`, pct: 100, label: 'Envío GRATIS', source: 'Ruleta', createdAt: r.ts });
  });
  coupons.forEach((c) => (c.expiresAt = c.createdAt + PROMO.couponDays * DAY));

  const usedIds = new Set(mine.filter((s) => s.status !== 'cancelled' && s.coupon?.id).map((s) => s.coupon.id));
  const now = Date.now();
  const available = coupons.filter((c) => !usedIds.has(c.id) && c.expiresAt > now).sort((a, b) => b.pct - a.pct);
  const used = coupons.filter((c) => usedIds.has(c.id));

  const inCycle = delivered.length % PROMO.stampCycle;
  const next = PROMO.stamps.find((x) => x.at > inCycle) || PROMO.stamps[0];
  return {
    deliveredCount: delivered.length,
    points,
    canSpin: points >= PROMO.spinCost,
    stampsInCycle: inCycle,
    nextStamp: next,
    toNext: next.at > inCycle ? next.at - inCycle : PROMO.stampCycle - inCycle + next.at,
    available,
    used,
    spins: spins.slice().reverse(),
  };
}

export function usePromo(me) {
  const { shipments, rewards } = useStore();
  return useMemo(() => computePromo(me, shipments, rewards), [me, shipments, rewards]);
}

/** Elige un premio según las probabilidades */
export function pickPrize() {
  const total = WHEEL.reduce((a, w) => a + w.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WHEEL.length; i++) {
    r -= WHEEL[i].weight;
    if (r < 0) return i;
  }
  return WHEEL.length - 1;
}

/** Registro del giro (queda en el historial; no se puede borrar) */
export function spinRecord(me, index) {
  const w = WHEEL[index];
  return {
    id: uid('r_'),
    userId: me.id,
    userName: me.name,
    type: 'spin',
    cost: PROMO.spinCost,
    prize: { key: w.key, label: w.label.replace('\n', ' '), pct: w.pct || 0, free: w.free || 0, points: w.points || 0 },
    ts: Date.now(),
  };
}
