// Utilidades de mapas, rutas, ETA y GPS.
// Rutas: OSRM (gratis, sin API key). Búsqueda de direcciones: Nominatim (OpenStreetMap).
// Si no hay internet para esos servicios, se usa una ruta aproximada en línea recta.

export const DEFAULT_CENTER = { lat: -17.9647, lng: -67.106 }; // Oruro, Bolivia; se reemplaza por tu GPS al abrir

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function distance(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const fmtKm = (m) => (m == null ? '—' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
export const fmtMin = (s) => {
  if (s == null) return '—';
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
export const fmtClock = (ts) => new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (ts) => new Date(ts).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/** Ruta por calles entre a y b. Devuelve { coords:[[lat,lng]], distance (m), duration (s), approx } */
export async function getRoute(a, b) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const res = await withTimeout(fetch(url), 8000);
    const json = await res.json();
    const r = json.routes?.[0];
    if (!r) throw new Error('sin ruta');
    return { coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distance: r.distance, duration: r.duration, approx: false };
  } catch {
    // Respaldo: línea recta + 45 % (por las calles suele ser 40–50 % más) y 25 km/h promedio.
    const d = distance(a, b) * 1.45;
    const steps = 30;
    const coords = Array.from({ length: steps + 1 }, (_, i) => [a.lat + ((b.lat - a.lat) * i) / steps, a.lng + ((b.lng - a.lng) * i) / steps]);
    return { coords, distance: d, duration: d / (25 / 3.6), approx: true };
  }
}

/** Distancia y tiempo que faltan, proyectando la posición del repartidor sobre la ruta. */
export function remainingOnRoute(route, pos) {
  if (!route?.coords?.length || !pos) return null;
  const pts = route.coords.map(([lat, lng]) => ({ lat, lng }));
  let best = 0;
  let bestD = Infinity;
  pts.forEach((p, i) => {
    const d = distance(p, pos);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  let rem = bestD;
  for (let i = best; i < pts.length - 1; i++) rem += distance(pts[i], pts[i + 1]);
  const speed = route.duration > 0 ? route.distance / route.duration : 7; // m/s
  return { distance: rem, duration: rem / speed, offRoute: bestD > 150 };
}

export async function searchAddress(q, near) {
  if (!q || q.length < 3) return [];
  const vb = near ? `&viewbox=${near.lng - 0.5},${near.lat + 0.5},${near.lng + 0.5},${near.lat - 0.5}` : '';
  try {
    const res = await withTimeout(
      fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=es&q=${encodeURIComponent(q)}${vb}`),
      8000
    );
    const json = await res.json();
    return json.map((r) => ({ lat: +r.lat, lng: +r.lon, address: r.display_name }));
  } catch {
    return [];
  }
}

export async function reverseGeocode({ lat, lng }) {
  try {
    const res = await withTimeout(fetch(`https://nominatim.openstreetmap.org/reverse?format=json&accept-language=es&lat=${lat}&lon=${lng}`), 6000);
    const json = await res.json();
    if (json.display_name) return json.display_name.split(',').slice(0, 4).join(',');
  } catch {
    /* sin red */
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

/** Navegación externa paso a paso */
export const googleMapsLink = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
export const wazeLink = (p) => `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;

/** Punto a cierta distancia (m) recorrida sobre una polilínea */
export function pointAlong(coords, meters) {
  let acc = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = { lat: coords[i][0], lng: coords[i][1] };
    const b = { lat: coords[i + 1][0], lng: coords[i + 1][1] };
    const d = distance(a, b);
    if (acc + d >= meters) {
      const t = d ? (meters - acc) / d : 0;
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, heading: bearing(a, b), done: false };
    }
    acc += d;
  }
  const last = coords[coords.length - 1];
  return { lat: last[0], lng: last[1], heading: 0, done: true };
}

/**
 * Lee una ubicación pegada desde WhatsApp / Google Maps:
 * "-17.96, -67.10", "https://maps.google.com/?q=-17.96,-67.10", ".../@-17.96,-67.10,15z", "geo:-17.96,-67.10".
 * (Los enlaces cortos maps.app.goo.gl no traen coordenadas: hay que abrirlos y copiar las coordenadas.)
 */
export function parseLatLng(text) {
  if (!text) return null;
  const t = decodeURIComponent(String(text));
  const pats = [/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, /[?&](?:q|query|ll|destination|daddr)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, /geo:(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/];
  for (const re of pats) {
    const m = t.match(re);
    if (m) {
      const lat = +m[1];
      const lng = +m[2];
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}
export const isShortMapsLink = (t) => /maps\.app\.goo\.gl|goo\.gl\/maps/.test(t || '');

/** Abre Google Maps con la ruta en auto/moto entre A y B (para comparar la distancia) */
export const googleMapsRouteLink = (a, b) => `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=driving`;
