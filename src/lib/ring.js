// Sonidos y avisos del sistema.
// • Avisos IMPORTANTES (envío nuevo, tu pedido cambió, solicitud de repartidor): tono tipo LLAMADA
//   que se repite hasta que la persona lo toca (máximo 30 s).
// • Mensajes: doble pitido corto.
// El tono se elige en Configuración → Notificaciones (Llamada · Corto · Silencio).
import { BUSINESS_NAME } from './config';

const TONE_KEY = 'envia2:tone';
export const TONES = { call: 'Llamada (largo, se repite)', short: 'Corto', off: 'Silencio (solo vibrar)' };
export const getTone = () => {
  try {
    return localStorage.getItem(TONE_KEY) || 'call';
  } catch {
    return 'call';
  }
};
export const setTone = (t) => {
  try {
    localStorage.setItem(TONE_KEY, t);
  } catch {
    /* sin almacenamiento */
  }
};

let ctx = null;
const audio = () => {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};
// El navegador solo deja sonar después de que la persona tocó la pantalla una vez: se "despierta" el audio al primer toque
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
}

function tone(freq, start, dur, vol = 0.25) {
  const c = audio();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Un "ring-ring" de teléfono (≈1,6 s) */
function ringOnce() {
  for (let i = 0; i < 2; i++) {
    const b = i * 0.5;
    for (let k = 0; k < 8; k++) {
      tone(k % 2 ? 480 : 620, b + k * 0.05, 0.05, 0.3);
    }
  }
}

let ringTimer = null;
let ringStop = null;
export function stopRing() {
  clearInterval(ringTimer);
  clearTimeout(ringStop);
  ringTimer = null;
  navigator.vibrate?.(0);
}

/** urgent = tono de llamada repetido; si no, doble pitido */
export function playAlert(urgent) {
  const t = getTone();
  if (t === 'off') return navigator.vibrate?.(urgent ? [600, 300, 600, 300, 600] : 200);
  if (!urgent || t === 'short') {
    tone(880, 0, 0.15);
    tone(1175, 0.18, 0.2);
    navigator.vibrate?.(200);
    return;
  }
  if (ringTimer) return; // ya está sonando
  ringOnce();
  navigator.vibrate?.([800, 400, 800, 400, 800]);
  ringTimer = setInterval(() => {
    ringOnce();
    navigator.vibrate?.([800, 400, 800]);
  }, 2600);
  ringStop = setTimeout(stopRing, 30000);
  // Cualquier toque en la pantalla lo apaga
  window.addEventListener('pointerdown', stopRing, { once: true });
}

/** Aviso del sistema (barra de notificaciones). En Android se DEBE usar el service worker:
 *  `new Notification()` da error en Chrome de Android (por eso antes no aparecía nada). */
export async function systemNotify(text, { tag, urgent, url } = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = {
    body: text,
    icon: './icon-192.png',
    badge: './icon-64.png',
    tag: tag || undefined,
    renotify: !!tag,
    requireInteraction: !!urgent,
    vibrate: urgent ? [800, 300, 800, 300, 800, 300, 800] : [300, 100, 300],
    data: { url: url || './' },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(BUSINESS_NAME, opts);
    new Notification(BUSINESS_NAME, opts); // computadora sin service worker
  } catch (e) {
    console.warn('aviso del sistema', e);
  }
}
