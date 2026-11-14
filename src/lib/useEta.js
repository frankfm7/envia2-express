import { useEffect, useState } from 'react';
import { remainingOnRoute } from './geo';

const HANDLING = 5 * 60; // 5 min para cargar la caja en el origen

/**
 * ETA en vivo para un envío.
 * - Antes de recoger: tiempo a origen + origen→destino + carga.
 * - Después de recoger: tiempo restante sobre la ruta actual.
 */
export function useEta(s) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);
  if (!s || ['delivered', 'cancelled'].includes(s.status)) return null;

  const trip = s.tripRoute;
  if (s.status === 'pending') return trip ? { seconds: trip.duration + 10 * 60, distance: trip.distance, label: 'Entrega estimada' } : null;

  const rem = remainingOnRoute(s.route, s.driverPos);
  if (s.status === 'accepted') {
    const toPickup = rem?.duration ?? s.route?.duration ?? 0;
    return {
      seconds: toPickup + HANDLING + (trip?.duration || 0),
      pickupSeconds: toPickup,
      distance: rem?.distance,
      label: 'Entrega estimada',
    };
  }
  if (s.status === 'arrived') return { seconds: 0, distance: 0, label: 'Llegó' };
  if (!rem) return trip ? { seconds: trip.duration, distance: trip.distance, label: 'Llega en' } : null;
  return { seconds: rem.duration, distance: rem.distance, offRoute: rem.offRoute, label: 'Llega en' };
}

export const arrivalClock = (seconds) => new Date(Date.now() + seconds * 1000).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
