// Bloqueo opcional de la app en ESTE celular: código, patrón o huella / Face ID.
// Se guarda solo en el dispositivo (no en la nube). Si se olvida, se cierra sesión y se vuelve a entrar.
import { sha256, biometricConfirm } from './proof';

const KEY = (uid) => `boxruta:lock:${uid}`;
const LAST = 'boxruta:lock:last-active';
export const LOCK_AFTER_MS = 60 * 1000; // se vuelve a pedir si la app estuvo en segundo plano más de 1 minuto

export function getLock(uid) {
  try {
    return JSON.parse(localStorage.getItem(KEY(uid))) || null;
  } catch {
    return null;
  }
}

const hashSecret = (uid, secret) => sha256(`envia2|${uid}|${secret}`);

export async function setLock(uid, type, secret) {
  const cfg = { type, createdAt: Date.now() };
  if (type === 'pin' || type === 'pattern') cfg.hash = await hashSecret(uid, secret);
  localStorage.setItem(KEY(uid), JSON.stringify(cfg));
}

export function clearLock(uid) {
  localStorage.removeItem(KEY(uid));
}

export async function checkSecret(uid, secret) {
  const cfg = getLock(uid);
  return !!cfg?.hash && (await hashSecret(uid, secret)) === cfg.hash;
}

export async function unlockWithBiometric(user) {
  const r = await biometricConfirm(user, `desbloqueo|${Date.now()}`);
  return !!r?.verified;
}

export const markActive = () => {
  try {
    sessionStorage.setItem(LAST, String(Date.now()));
  } catch {
    /* sin almacenamiento */
  }
};
export const lastActive = () => {
  try {
    return Number(sessionStorage.getItem(LAST)) || 0;
  } catch {
    return 0;
  }
};
