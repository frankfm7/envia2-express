// Modo NUBE: Firebase (plan gratuito "Spark").
//  - Inicio de sesión con Google.
//  - Firestore con caché sin conexión: si no hay señal, todo (firmas, fotos,
//    estados) se guarda en el celular y se sube solo cuando vuelve internet.
import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';

const env = import.meta.env;
export const ADMIN_EMAILS = (env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Firestore no acepta listas dentro de listas (ej. coordenadas [[lat,lng]]): las guardamos como texto.
const enc = (v) => {
  if (Array.isArray(v)) return v.some(Array.isArray) ? { __json: JSON.stringify(v) } : v.map(enc);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]));
  return v;
};
const dec = (v) => {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') {
    if (typeof v.__json === 'string') return JSON.parse(v.__json);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]));
  }
  return v;
};

export function createCloudBackend(ctx) {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  // Sesión guardada en el celular (IndexedDB / localStorage): no se cierra al salir de la app.
  // Firebase renueva el acceso solo cada hora; si el renuevo falla, revisar la clave de API (ver guía).
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });

  let unsubs = [];
  const sources = {}; // nombre de consulta -> { col, docs, pending }
  let userUid = null;
  let listenKey = '';

  const sync = { ready: false, online: navigator.onLine, pending: false, cloud: true };
  const setSync = (p) => {
    Object.assign(sync, p);
    ctx.setSync({ ...sync });
  };
  window.addEventListener('online', () => setSync({ online: true }));
  window.addEventListener('offline', () => setSync({ online: false }));

  const publish = () => {
    const out = { users: new Map(), shipments: new Map(), messages: new Map(), notifications: new Map(), settings: new Map(), rewards: new Map() };
    let pending = false;
    for (const s of Object.values(sources)) {
      s.docs.forEach((d) => out[s.col].set(d.id, d));
      pending ||= s.pending;
    }
    const by = (k) => (a, b) => (b[k] || 0) - (a[k] || 0);
    ctx.setData({
      users: [...out.users.values()],
      shipments: [...out.shipments.values()].sort(by('createdAt')),
      messages: [...out.messages.values()].sort((a, b) => a.ts - b.ts),
      notifications: [...out.notifications.values()].sort((a, b) => a.ts - b.ts),
      settings: [...out.settings.values()],
      rewards: [...out.rewards.values()].sort((a, b) => a.ts - b.ts),
    });
    if (pending !== sync.pending) setSync({ pending });
  };

  const listen = (name, col, q) => {
    unsubs.push(
      onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          sources[name] = { col, docs: snap.docs.map((d) => ({ ...dec(d.data()), id: d.id })), pending: snap.metadata.hasPendingWrites };
          publish();
        },
        (err) => console.warn('Firestore', name, err.code)
      )
    );
  };

  const stopAll = () => {
    unsubs.forEach((u) => u());
    unsubs = [];
    Object.keys(sources).forEach((k) => delete sources[k]);
  };

  function startListeners(me) {
    const key = `${me.id}:${me.role}:${me.approved}`;
    if (key === listenKey) return;
    listenKey = key;
    stopAll();
    const uid = me.id;
    const S = collection(db, 'shipments');
    unsubs.push(
      onSnapshot(doc(db, 'users', uid), (d) => {
        if (d.exists()) {
          sources.me = { col: 'users', docs: [{ ...d.data(), id: uid }], pending: false };
          publish();
          startListeners({ ...d.data(), id: uid });
        }
      })
    );
    if (me.role === 'admin') {
      listen('users', 'users', collection(db, 'users'));
      listen('ships', 'shipments', query(S, orderBy('createdAt', 'desc'), limit(500)));
    } else {
      // Todos (también repartidores) pueden pedir envíos como clientes
      listen('sent', 'shipments', query(S, where('clientId', '==', uid)));
      listen('recv', 'shipments', query(S, where('recipientUid', '==', uid)));
      if (me.role === 'driver' && me.approved) {
        listen('pending', 'shipments', query(S, where('status', '==', 'pending')));
        listen('mine', 'shipments', query(S, where('driverId', '==', uid)));
      }
    }
    listen('msgs', 'messages', query(collection(db, 'messages'), where('participants', 'array-contains', uid)));
    listen('notifs', 'notifications', query(collection(db, 'notifications'), where('userId', '==', uid)));
    // Ajustes del negocio (QR de cobro) y promociones (puntos / cupones)
    listen('settings', 'settings', collection(db, 'settings'));
    listen('rewards', 'rewards', me.role === 'admin' ? collection(db, 'rewards') : query(collection(db, 'rewards'), where('userId', '==', uid)));
  }

  getRedirectResult(auth).catch(() => {});
  onAuthStateChanged(auth, async (u) => {
    stopAll();
    listenKey = '';
    if (!u) {
      userUid = null;
      ctx.setSession(null);
      ctx.setData({ users: [], shipments: [], messages: [], notifications: [], settings: [], rewards: [] });
      return setSync({ ready: true });
    }
    userUid = u.uid;
    const base = { userId: u.uid, email: u.email, name: u.displayName, photo: u.photoURL, phone: u.phoneNumber || '', isAdminEmail: ADMIN_EMAILS.includes((u.email || '').toLowerCase()) };
    // El perfil se lee de la caché local primero (funciona sin señal).
    unsubs.push(
      onSnapshot(
        doc(db, 'users', u.uid),
        (d) => {
          if (!d.exists()) {
            if (!d.metadata.fromCache || !navigator.onLine) ctx.setSession({ ...base, needsProfile: true });
            setSync({ ready: true });
            return;
          }
          const me = { ...d.data(), id: u.uid };
          ctx.setSession(base);
          sources.me = { col: 'users', docs: [me], pending: false };
          publish();
          setSync({ ready: true });
          startListeners(me);
        },
        () => setSync({ ready: true })
      )
    );
  });

  const ref = (col, id) => doc(db, col, id);
  const swallow = (p) => p.catch((e) => console.warn('Firestore write', e.code || e));

  return {
    put: (col, id, data) => swallow(setDoc(ref(col, id), enc({ ...data, id }))),
    patch(col, id, fields, pushes = {}) {
      const data = enc(fields);
      for (const [k, v] of Object.entries(pushes)) data[k] = arrayUnion(enc(v));
      return swallow(updateDoc(ref(col, id), data));
    },
    patchMany(col, ids, fields) {
      const b = writeBatch(db);
      ids.forEach((id) => b.update(ref(col, id), enc(fields)));
      return swallow(b.commit());
    },
    remove: (col, id) => swallow(deleteDoc(ref(col, id))),
    async accept(id, fields, ev) {
      if (!navigator.onLine) throw new Error('Necesitas señal para aceptar un envío (así dos repartidores no toman la misma caja).');
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref('shipments', id));
        if (!snap.exists() || snap.data().status !== 'pending') return false;
        tx.update(ref('shipments', id), { ...enc(fields), events: arrayUnion(enc(ev)) });
        return true;
      });
    },
    async claim(id, token, uid) {
      if (!navigator.onLine) throw new Error('Necesitas internet para abrir este enlace la primera vez.');
      try {
        await updateDoc(ref('shipments', id), { recipientUid: uid, claimKey: token, updatedAt: Date.now() });
      } catch (e) {
        // Si ya estaba vinculado a esta misma cuenta, no es un error.
        const snap = await getDoc(ref('shipments', id)).catch(() => null);
        if (snap?.exists() && snap.data().recipientUid === uid) return;
        throw new Error('Enlace no válido o ya usado por otra cuenta');
      }
    },
    // Página pública (seguimiento + comprobante) para clientes SIN la app
    putPublic: (token, data) => swallow(setDoc(ref('public', token), enc(data))),
    subscribePublic(token, cb) {
      return onSnapshot(
        ref('public', token),
        (d) => cb(d.exists() ? dec(d.data()) : null),
        () => cb(null)
      );
    },
    subscribeEvidence(id, cb) {
      return onSnapshot(
        ref('evidence', id),
        (d) => cb(d.exists() ? dec(d.data()) : null),
        () => cb(null)
      );
    },
    async getEvidence(id) {
      const d = await getDoc(ref('evidence', id)).catch(() => null);
      return d?.exists() ? dec(d.data()) : null;
    },
    saveEvidence: (id, patch) => swallow(setDoc(ref('evidence', id), enc(patch), { merge: true })),
    async loginGoogle() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) await signInWithRedirect(auth, provider);
        else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') throw e;
      }
    },
    // ── Entrar con número de celular (código por SMS) ──
    async loginPhoneStart(phoneE164, buttonId) {
      if (!window.__recaptcha) window.__recaptcha = new RecaptchaVerifier(auth, buttonId, { size: 'invisible' });
      try {
        this._confirm = await signInWithPhoneNumber(auth, phoneE164, window.__recaptcha);
      } catch (e) {
        window.__recaptcha?.clear?.();
        window.__recaptcha = null;
        throw e;
      }
    },
    async loginPhoneConfirm(code) {
      if (!this._confirm) throw new Error('Primero pide el código');
      await this._confirm.confirm(code);
    },
    getOne: async (col, id) => {
      const d = await getDoc(ref(col, id)).catch(() => null);
      return d?.exists() ? { ...dec(d.data()), id } : null;
    },
    /** El repartidor activa su cuenta con el código que le dio el administrador (las reglas lo verifican) */
    async activateDriver(uid, code) {
      try {
        await updateDoc(ref('users', uid), { role: 'driver', approved: true, authCode: code, driverStatus: 'approved', online: true, updatedAt: Date.now() });
      } catch {
        throw new Error('Código incorrecto');
      }
    },
    async logout() {
      stopAll();
      await signOut(auth);
    },
    uid: () => userUid,
    async exportAll(data) {
      const evidence = {};
      for (const s of data.shipments.filter((x) => x.status === 'delivered')) {
        const e = await this.getEvidence(s.id);
        if (e) evidence[s.id] = e;
      }
      return { ...data, evidence };
    },
  };
}
