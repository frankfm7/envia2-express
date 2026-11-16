// Tiempo de espera del repartidor (recojo y entrega).
// Empieza cuando el repartidor toca "Esperando…"; termina al recoger / entregar.
// Los primeros minutos son gratis; después se cobra por bloques. El repartidor puede PERDONAR (condonar) la espera.
import { RULES, waitCharge } from './tariff';

const lastEv = (s, status, after = 0) => (s.events || []).filter((e) => e.status === status && e.ts >= after).map((e) => e.ts).pop() || null;

/** which: 'pickup' | 'drop' */
export function waitInfo(s, which, now = Date.now()) {
  const start = which === 'pickup' ? s.pickupArrivedAt : s.dropWaitAt;
  if (!start) return null;
  const end = which === 'pickup' ? lastEv(s, 'picked_up', start) : lastEv(s, 'delivered', start);
  const running = !end && (which === 'pickup' ? s.status === 'accepted' : s.status === 'arrived');
  const until = end || (running ? now : start);
  const seconds = Math.max(0, Math.floor((until - start) / 1000));
  const minutes = seconds / 60;
  const waived = !!s.waitWaived?.[which];
  const c = waitCharge(minutes);
  return {
    which,
    start,
    end,
    running,
    seconds,
    minutes,
    free: RULES.freeWaitMin,
    freeLeft: Math.max(0, RULES.freeWaitMin - minutes),
    over: minutes > RULES.freeWaitMin,
    fullAmount: c.amount, // lo que costaría
    amount: waived ? 0 : c.amount, // lo que se cobra
    waived,
  };
}
export const fmtClockSec = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
export const WAIT_LABEL = { pickup: 'en el recojo', drop: 'en la entrega' };

/** Total del envío con las esperas (cobradas o condonadas) */
export const shipmentTotal = (s, now = Date.now()) => (Number(s.price) || 0) + (waitInfo(s, 'pickup', now)?.amount || 0) + (waitInfo(s, 'drop', now)?.amount || 0);
