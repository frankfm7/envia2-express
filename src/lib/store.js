// ─────────────────────────────────────────────────────────────────────────────
// Capa de datos de Envia2 Express.
//  • Si existen las claves de Firebase (.env / Vercel) → modo NUBE con Google y
//    funcionamiento sin internet (los cambios se suben solos al volver la señal).
//  • Si no → modo DEMO local (todo en este navegador; ideal para probar).
// Las pantallas solo usan las funciones exportadas aquí.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createLocalBackend } from './backend/local';

export const CLOUD = !!import.meta.env.VITE_FIREBASE_API_KEY;

let data = { users: [], shipments: [], messages: [], notifications: [], settings: [], rewards: [] };
let session = null;
let sync = { ready: false, online: navigator.onLine, pending: false, cloud: CLOUD };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

const ctx = {
  setData: (d) => {
    data = d;
    emit();
  },
  setSession: (s) => {
    session = s;
    emit();
  },
  setSync: (s) => {
    sync = { ...sync, ...s };
    emit();
  },
};

let backend = null;
const ready = (async () => {
  if (CLOUD) {
    const { createCloudBackend } = await import('./backend/cloud');
    backend = createCloudBackend(ctx);
  } else backend = createLocalBackend(ctx);
})();
const B = async () => (await ready, backend);

// ── Hooks ───────────────────────────────────────────────────────────────────
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useStore = () => useSyncExternalStore(subscribe, () => data);
export const useSession = () => useSyncExternalStore(subscribe, () => session);
export const useSync = () => useSyncExternalStore(subscribe, () => sync);
export const getState = () => data;

/** Evidencias pesadas (fotos y firma) se guardan aparte y se cargan solo cuando se necesitan. */
export function useEvidence(id) {
  const [ev, setEv] = useState(undefined);
  useEffect(() => {
    if (!id) return;
    let off = () => {};
    let alive = true;
    B().then((b) => {
      if (alive) off = b.subscribeEvidence(id, setEv);
    });
    return () => {
      alive = false;
      off();
    };
  }, [id]);
  return ev;
}
export const saveEvidence = async (id, patch) => (await B()).saveEvidence(id, patch);
export const getEvidence = async (id) => (await B()).getEvidence(id);

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const code = () => 'BR-' + Math.random().toString(36).slice(2, 6).toUpperCase();
const token = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
const pin = () => String(Math.floor(1000 + Math.random() * 9000));
export const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-9);

// ── Sesión ──────────────────────────────────────────────────────────────────
/** Modo demo: entrar con nombre y teléfono */
export async function localLogin({ name, phone, role, vehicle, plate }) {
  const b = await B();
  const clean = phone.replace(/[^\d+]/g, '');
  let user = data.users.find((u) => phoneKey(u.phone) === phoneKey(clean) && u.role === role);
  if (!user) {
    user = { id: uid('u_'), name, phone: clean, role, online: false, approved: true, driverStatus: 'none', addresses: [], createdAt: Date.now() };
    b.put('users', user.id, user);
  } else b.patch('users', user.id, { name, ...(vehicle && { vehicle }), ...(plate && { plate }) });
  b.localLogin(user.id);
}

export const loginGoogle = async () => (await B()).loginGoogle();
export const loginEmail = async (email, password) => (await B()).loginEmail(email, password);
export const registerEmail = async (email, password, name) => (await B()).registerEmail(email, password, name);
export const resetPassword = async (email) => (await B()).resetPassword(email);

/** Modo nube: completar perfil después de entrar con Google */
/** Modo nube: completar perfil después de entrar (Google o celular). Todos entran como CLIENTE;
 *  los repartidores se activan después con el código que da el administrador. */
export async function saveProfile({ name, phone }) {
  const b = await B();
  const id = session.userId;
  const isAdmin = session.isAdminEmail;
  b.put('users', id, {
    name,
    phone: phone.replace(/[^\d+]/g, ''),
    email: session.email || '',
    photo: session.photo || '',
    role: isAdmin ? 'admin' : 'client',
    online: false,
    approved: true,
    driverStatus: 'none',
    addresses: [],
    createdAt: Date.now(),
  });
  session = { ...session, needsProfile: false };
  emit();
}

export const loginPhoneStart = async (phoneE164, buttonId) => (await B()).loginPhoneStart(phoneE164, buttonId);
export const loginPhoneConfirm = async (code) => (await B()).loginPhoneConfirm(code);

export const logout = async () => (await B()).logout();
export const updateUser = async (id, patch) => (await B()).patch('users', id, patch);
export const getOne = async (col, id) => (await B()).getOne(col, id);

/** Usuario con sesión iniciada */
export const useMe = () => {
  const { users } = useStore();
  const s = useSession();
  return users.find((u) => u.id === s?.userId) || null;
};

// ── Cambiar de perfil sin cerrar sesión (admin → repartidor / cliente; repartidor → cliente) ──
const VIEW_KEY = 'boxruta:view-role:';
// Un repartidor suspendido o bloqueado sigue viendo su perfil de repartidor (con el aviso), y puede pedir como cliente
export const allowedRoles = (me) => (me?.role === 'admin' ? ['admin', 'driver', 'client'] : me?.role === 'driver' ? ['driver', 'client'] : ['client']);
export function getViewRole(me) {
  if (!me) return 'client';
  let r = null;
  try {
    r = localStorage.getItem(VIEW_KEY + me.id);
  } catch {
    /* sin almacenamiento */
  }
  return allowedRoles(me).includes(r) ? r : me.role;
}
export function setViewRole(me, role) {
  try {
    localStorage.setItem(VIEW_KEY + me.id, role);
  } catch {
    /* sin almacenamiento */
  }
  emit();
}
export const ROLE_LABEL = { client: 'Cliente', driver: 'Repartidor', admin: 'Administrador' };

// ── Direcciones guardadas ──
export async function saveAddress(me, addr) {
  const list = [...(me.addresses || []).filter((a) => a.id !== addr.id), { ...addr, id: addr.id || uid('a_') }];
  return updateUser(me.id, { addresses: list });
}
export const deleteAddress = (me, id) => updateUser(me.id, { addresses: (me.addresses || []).filter((a) => a.id !== id) });

// ── Solicitud para ser repartidor → el administrador da un código de ingreso ──
export async function submitDriverApplication(me, app) {
  const b = await B();
  b.put('driverApps', me.id, { ...app, userId: me.id, email: me.email || '', status: 'pending', createdAt: Date.now() });
  // (El aviso al administrador lo genera su propia app al ver la solicitud pendiente: no se duplica ni se pierde)
  b.patch('users', me.id, {
    driverStatus: 'pending',
    driverApp: { fullName: app.fullName, ci: app.ci, vehicle: app.vehicle, plate: app.plate, sentAt: Date.now() },
  });
}
/** Admin: aprueba y genera el código de ingreso (6 dígitos) */
export async function approveDriverApp(userId, app) {
  const b = await B();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  b.put('driverCodes', userId, { code, createdAt: Date.now() });
  b.patch('driverApps', userId, { status: 'approved', reviewedAt: Date.now() });
  b.patch('users', userId, {
    driverStatus: 'code_sent',
    vehicle: app?.vehicle || '',
    plate: app?.plate || '',
    ...(app?.selfieThumb && { photo: app.selfieThumb }),
  });
  return code;
}
export async function rejectDriverApp(userId, reason) {
  const b = await B();
  b.patch('driverApps', userId, { status: 'rejected', reason, reviewedAt: Date.now() });
  b.patch('users', userId, { driverStatus: 'rejected', driverRejectReason: reason });
}
/** Repartidor: ingresa el código para activar su cuenta */
export async function activateDriver(me, code) {
  await (await B()).activateDriver(me.id, code.trim());
}

// ── Estados ─────────────────────────────────────────────────────────────────
export const STATUS = {
  awaiting_confirmation: { label: 'Esperando que confirme lugar y hora', color: '#d946ef', step: 0 },
  pending: { label: 'Buscando repartidor', color: '#f59e0b', step: 0 },
  accepted: { label: 'Repartidor en camino a recoger', color: '#3b82f6', step: 1 },
  picked_up: { label: 'Caja recogida', color: '#8b5cf6', step: 2 },
  in_transit: { label: 'En camino al destino', color: '#0ea5e9', step: 3 },
  arrived: { label: 'Repartidor en el punto de entrega', color: '#10b981', step: 4 },
  delivered: { label: 'Entregado', color: '#16a34a', step: 5 },
  stored: { label: 'En oficina (no se pudo entregar)', color: '#a16207', step: 4 },
  cancelled: { label: 'Cancelado', color: '#ef4444', step: -1 },
};
export const ACTIVE = ['accepted', 'picked_up', 'in_transit', 'arrived'];

/** Notificación dentro de la app para un usuario */
export async function notifyUser(userId, shipmentId, text) {
  if (!userId) return;
  const id = uid('n_');
  (await B()).put('notifications', id, { userId, shipmentId, text, ts: Date.now(), read: false });
}

const interested = (sh) => [...new Set([sh.clientId, sh.recipientUid].filter(Boolean))];

// ── Envíos ──────────────────────────────────────────────────────────────────
export async function createShipment(creator, d, { status = 'pending' } = {}) {
  const b = await B();
  const id = uid('s_');
  b.put('shipments', id, {
    code: code(),
    pin: pin(),
    claimToken: token(),
    publicToken: token(),
    clientId: creator.id,
    clientName: creator.name,
    clientPhone: creator.phone,
    recipientUid: null,
    driverId: null,
    status,
    events: [{ status, ts: Date.now() }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...d,
  });
  return id;
}

/**
 * Actualiza un envío. Opciones:
 *  status/note/pos → agrega un evento al historial y avisa al cliente/destinatario
 *  notify: [{ to, text }] → avisos extra (por ejemplo al repartidor)
 */
export async function updateShipment(id, patch, { status, note, pos, notify = [] } = {}) {
  const b = await B();
  const sh = data.shipments.find((x) => x.id === id);
  const fields = { ...patch, updatedAt: Date.now() };
  const pushes = {};
  if (status && status !== sh?.status) {
    fields.status = status;
    pushes.events = { status, ts: Date.now(), note: note || null, pos: pos ? { lat: pos.lat, lng: pos.lng } : null };
    const text = `${sh?.code}: ${STATUS[status].label}${note ? ' · ' + note : ''}`;
    const me = session?.userId;
    const to = sh ? interested(sh) : [];
    if (sh?.driverId && ['cancelled', 'pending'].includes(status)) to.push(sh.driverId);
    to.filter((u) => u !== me).forEach((u) => notifyUser(u, id, text));
  }
  b.patch('shipments', id, fields, pushes);
  notify.filter((n) => n.to && n.to !== session?.userId).forEach((n) => notifyUser(n.to, id, n.text));
}

/** Posición del repartidor (sin evento en el historial) */
export async function setDriverPosition(id, pos, track) {
  (await B()).patch('shipments', id, { driverPos: pos, track });
}

export async function acceptShipment(id, driver) {
  const b = await B();
  const ev = { status: 'accepted', ts: Date.now(), note: driver.name, pos: null };
  const ok = await b.accept(
    id,
    { status: 'accepted', driverId: driver.id, driverName: driver.name, driverPhone: driver.phone, vehicle: driver.vehicle || '', plate: driver.plate || '', updatedAt: Date.now() },
    ev
  );
  if (ok) {
    const sh = data.shipments.find((x) => x.id === id);
    if (sh) interested(sh).forEach((u) => notifyUser(u, id, `${sh.code}: ${driver.name} aceptó tu envío`));
  }
  return ok;
}

/** Vincula un envío a la cuenta que abrió el enlace (consultora o destinatario) */
export const claimShipment = async (id, token) => (await B()).claim(id, token, session.userId);

// ── Mensajes (chat básico dentro de la app; solo texto para que sea liviano) ─
export async function sendMessage(shipmentId, from, text) {
  const b = await B();
  const sh = data.shipments.find((x) => x.id === shipmentId);
  const participants = [...new Set([sh?.clientId, sh?.driverId, sh?.recipientUid, from.id].filter(Boolean))];
  const id = uid('m_');
  b.put('messages', id, { shipmentId, fromId: from.id, fromName: from.name, role: from.role, text, ts: Date.now(), participants });
  participants.filter((p) => p !== from.id).forEach((p) => notifyUser(p, shipmentId, `💬 ${from.name}: ${text}`));
}

/** ¿La otra persona usa la app? (si no, se usa WhatsApp) */
export const recipientHasApp = (s) => !!s.recipientUid || (!!s.selfRecipient && s.clientId !== s.driverId);
export const senderHasApp = (s) => !!s.clientId && s.clientId !== s.driverId && !s.createdByDriver && s.kind !== 'catalog';

export async function markRead(userId, shipmentId) {
  const ids = data.notifications.filter((n) => n.userId === userId && !n.read && (!shipmentId || n.shipmentId === shipmentId)).map((n) => n.id);
  if (!ids.length) return;
  const b = await B();
  b.patchMany('notifications', ids, { read: true });
  // limpieza: avisos leídos de hace más de 7 días
  data.notifications.filter((n) => n.userId === userId && n.read && n.ts < Date.now() - 7 * 864e5).forEach((n) => b.remove('notifications', n.id));
}

// ── Respaldo ────────────────────────────────────────────────────────────────
export async function exportBackup() {
  const all = await (await B()).exportAll(data);
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `boxruta-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}
export async function importBackup(json) {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed.shipments)) throw new Error('Archivo no válido');
  const b = await B();
  if (!b.importAll) throw new Error('La restauración solo está disponible en modo demo');
  b.importAll(parsed);
}
export async function resetAll() {
  const b = await B();
  if (!b.resetAll) return alert('En modo nube los datos se borran desde la consola de Firebase.');
  b.resetAll();
}

// ── Enlace público para clientes SIN la app ─────────────────────────────────
// El repartidor publica una copia (sin PIN ni datos privados) que el cliente ve
// desde el enlace de WhatsApp: seguimiento en vivo y comprobante firmado.
export const publicLink = (s) => `${location.origin}${location.pathname}#/t/${s.publicToken}`;

export async function publishPublic(s, evidence) {
  if (!s?.publicToken) return;
  const b = await B();
  const doc = {
    id: s.id,
    code: s.code,
    status: s.status,
    events: s.events || [],
    kind: s.kind || null,
    brand: s.brand || null,
    orderNo: s.orderNo || null,
    qty: s.qty || 1,
    size: s.size || 'M',
    price: s.price || 0,
    finalPrice: s.finalPrice ?? null,
    routeKm: s.routeKm ?? null,
    service: s.service || 'simple',
    payment: s.payment || null,
    clientName: s.clientName || '',
    recipient: { name: s.recipient?.name || '' },
    dropoff: s.dropoff || null,
    meeting: s.meeting || null,
    driverId: s.driverId || null,
    driverName: s.driverName || '',
    driverPhone: s.driverPhone || '',
    vehicle: s.vehicle || '',
    plate: s.plate || '',
    driverPos: ['delivered', 'cancelled'].includes(s.status) ? null : s.driverPos || null,
    route: ['delivered', 'cancelled'].includes(s.status) ? null : s.route || null,
    tripRoute: s.tripRoute || null,
    proof: s.proof || null,
    updatedAt: Date.now(),
  };
  if (evidence) doc.evidence = { photo: evidence.photo || null, signature: evidence.signature || null, pickupPhoto: evidence.pickupPhoto || null };
  b.putPublic(s.publicToken, doc);
}

export function usePublic(tokenId) {
  const [doc, setDoc] = useState(undefined);
  useEffect(() => {
    let off = () => {};
    let alive = true;
    B().then((b) => {
      if (alive) off = b.subscribePublic(tokenId, setDoc);
    });
    return () => {
      alive = false;
      off();
    };
  }, [tokenId]);
  return doc;
}

/** Envíos antiguos sin enlace público: se les crea uno. */
export async function ensurePublicToken(s) {
  if (s.publicToken) return s.publicToken;
  const t = token();
  (await B()).patch('shipments', s.id, { publicToken: t });
  return t;
}

// ── Ajustes del negocio (QR de cobro, etc.) ─────────────────────────────────
export const useSettings = () => {
  const { settings } = useStore();
  return (settings || []).find((x) => x.id === 'app') || {};
};
export async function saveSettings(patch) {
  const b = await B();
  const cur = (data.settings || []).find((x) => x.id === 'app') || {};
  b.put('settings', 'app', { ...cur, ...patch, updatedAt: Date.now() });
}

// ── Promociones: guardar un giro de la ruleta ───────────────────────────────
export async function saveReward(rec) {
  (await B()).put('rewards', rec.id, rec);
}

/** Admin: quitar a alguien como repartidor (queda como cliente; se borran sus documentos) */
export async function removeDriverAccount(userId) {
  const b = await B();
  b.patch('users', userId, { role: 'client', approved: true, online: false, driverStatus: 'removed', suspendedUntil: null, vehicle: '', plate: '', badge: null });
  b.remove('driverApps', userId);
  b.remove('driverCodes', userId);
}

/** Repartidor aprobado actualiza sus datos (fotos, carnet, vehículo, contactos) */
export async function updateDriverApplication(me, app) {
  const b = await B();
  b.put('driverApps', me.id, { ...app, userId: me.id, email: me.email || '', status: 'approved', updatedAt: Date.now() });
  notifyAdmins(`✏️ ${me.name} actualizó sus datos de repartidor.`, 'driver-app');
  b.patch('users', me.id, {
    vehicle: app.vehicle,
    plate: app.plate,
    ...(app.selfieThumb && { photo: app.selfieThumb }),
    driverApp: { fullName: app.fullName, ci: app.ci, vehicle: app.vehicle, plate: app.plate, sentAt: me.driverApp?.sentAt || Date.now(), updatedAt: Date.now() },
  });
}

// ── Administradores (para avisos y chat de soporte) ─────────────────────────
export const adminUids = () => (data.settings || []).find((x) => x.id === 'app')?.adminUids || [];
/** Registra al administrador que entra (para que le lleguen los avisos y los chats de soporte) */
export async function registerAdmin(me) {
  if (me?.role !== 'admin' || adminUids().includes(me.id)) return;
  saveSettings({ adminUids: [...adminUids(), me.id] });
}
/** Aviso dentro de la app a todos los administradores */
export function notifyAdmins(text, ref = null) {
  adminUids().forEach((a) => a !== session?.userId && notifyUser(a, ref, text));
}

// ── Chats directos (administrador ↔ repartidor / cliente, y soporte) ────────
export const dmThread = (a, b) => 'dm:' + [a, b].sort().join('_');
export const supportThread = (uid) => 'sup:' + uid;
export async function sendDirect(threadId, from, participants, text, toName) {
  const b = await B();
  const ps = [...new Set([...participants, from.id].filter(Boolean))];
  const id = uid('m_');
  b.put('messages', id, { threadId, shipmentId: null, fromId: from.id, fromName: from.name, role: from.role, text, ts: Date.now(), participants: ps, toName: toName || null });
  ps.filter((p) => p !== from.id).forEach((p) => notifyUser(p, threadId, `💬 ${from.name}: ${text}`));
}
