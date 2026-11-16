// Modo DEMO / sin nube: los datos viven en este navegador (localStorage) y se
// sincronizan al instante entre pestañas. Se usa cuando no hay claves de Firebase.
const KEY = 'boxruta:data:v2';
const EV = 'boxruta:ev:';
const PUB = 'boxruta:pub:';
const SESSION_KEY = 'boxruta:session';
const COLS = ['users', 'shipments', 'messages', 'notifications', 'driverApps', 'driverCodes', 'settings', 'rewards'];

export function createLocalBackend(ctx) {
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('boxruta') : null;
  const evListeners = new Map(); // id -> Set(cb)

  const load = () => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY)) || {};
      return Object.fromEntries(COLS.map((c) => [c, d[c] || []]));
    } catch {
      return Object.fromEntries(COLS.map((c) => [c, []]));
    }
  };
  let data = load();

  const persist = (msg = { t: 'data' }) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      alert('El almacenamiento del navegador está lleno. Descarga un respaldo desde el Panel y borra entregas antiguas.');
    }
    channel?.postMessage(msg);
    ctx.setData(data);
  };

  const readEv = (id) => {
    try {
      return JSON.parse(localStorage.getItem(EV + id)) || null;
    } catch {
      return null;
    }
  };
  const fireEv = (id) => evListeners.get(id)?.forEach((cb) => cb(readEv(id)));

  const onRemote = (m) => {
    if (m?.t === 'ev') return fireEv(m.id);
    data = load();
    ctx.setData(data);
  };
  channel?.addEventListener('message', (e) => onRemote(e.data));
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) onRemote({ t: 'data' });
    else if (e.key?.startsWith(EV)) fireEv(e.key.slice(EV.length));
  });

  ctx.setData(data);
  ctx.setSync({ ready: true, online: navigator.onLine, pending: false, cloud: false });
  try {
    // Cada pestaña tiene su sesión; al abrir la app de nuevo se recupera la última (no hay que volver a entrar)
    const tab = sessionStorage.getItem(SESSION_KEY);
    const s = tab !== null ? JSON.parse(tab) : JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s) ctx.setSession(s);
  } catch {
    /* sin sesión */
  }

  return {
    put(col, id, doc) {
      const arr = data[col];
      const i = arr.findIndex((x) => x.id === id);
      data = { ...data, [col]: i >= 0 ? arr.map((x) => (x.id === id ? { ...doc, id } : x)) : [{ ...doc, id }, ...arr] };
      persist();
    },
    patch(col, id, fields, pushes = {}) {
      data = {
        ...data,
        [col]: data[col].map((x) => {
          if (x.id !== id) return x;
          const n = { ...x, ...fields };
          for (const [k, v] of Object.entries(pushes)) n[k] = [...(x[k] || []), v];
          return n;
        }),
      };
      persist();
    },
    patchMany(col, ids, fields) {
      const set = new Set(ids);
      data = { ...data, [col]: data[col].map((x) => (set.has(x.id) ? { ...x, ...fields } : x)) };
      persist();
    },
    remove(col, id) {
      data = { ...data, [col]: data[col].filter((x) => x.id !== id) };
      persist();
    },
    async accept(id, fields, ev) {
      const sh = data.shipments.find((x) => x.id === id);
      if (!sh || sh.status !== 'pending') return false;
      this.patch('shipments', id, fields, { events: ev });
      return true;
    },
    async loginGuest() {
      const id = 'u_guest_' + Date.now().toString(36);
      this.put('users', id, { name: 'Invitado', phone: '', role: 'client', isGuest: true, online: false, approved: true, driverStatus: 'none', addresses: [], createdAt: Date.now() });
      this.localLogin(id);
    },
    async upgradeGuestGoogle() {
      return {};
    },
    async getOne(col, id) {
      return data[col]?.find((x) => x.id === id) || null;
    },
    async activateDriver(uid, code) {
      const c = data.driverCodes.find((x) => x.id === uid);
      if (!c || c.code !== code) throw new Error('Código incorrecto');
      this.patch('users', uid, { role: 'driver', approved: true, authCode: code, driverStatus: 'approved', online: true, updatedAt: Date.now() });
    },
    async claim(id, token, uid) {
      const sh = data.shipments.find((x) => x.id === id);
      if (!sh) throw new Error('Envío no encontrado');
      if (sh.recipientUid && sh.recipientUid !== uid) throw new Error('Este envío ya fue vinculado a otra cuenta');
      if (sh.claimToken !== token) throw new Error('Enlace no válido');
      this.patch('shipments', id, { recipientUid: uid, claimKey: token, updatedAt: Date.now() });
    },
    // Página pública (seguimiento + comprobante) para clientes SIN la app
    async putPublic(token, doc) {
      localStorage.setItem(PUB + token, JSON.stringify(doc));
      evListeners.get('pub:' + token)?.forEach((cb) => cb(doc));
      channel?.postMessage({ t: 'pub', token });
    },
    subscribePublic(token, cb) {
      const key = 'pub:' + token;
      const read = () => {
        try {
          return JSON.parse(localStorage.getItem(PUB + token));
        } catch {
          return null;
        }
      };
      if (!evListeners.has(key)) evListeners.set(key, new Set());
      const fn = () => cb(read());
      evListeners.get(key).add(fn);
      const onStorage = (e) => e.key === PUB + token && fn();
      const onMsg = (e) => e.data?.t === 'pub' && e.data.token === token && fn();
      window.addEventListener('storage', onStorage);
      channel?.addEventListener('message', onMsg);
      fn();
      return () => {
        evListeners.get(key)?.delete(fn);
        window.removeEventListener('storage', onStorage);
        channel?.removeEventListener('message', onMsg);
      };
    },
    subscribeEvidence(id, cb) {
      if (!evListeners.has(id)) evListeners.set(id, new Set());
      evListeners.get(id).add(cb);
      cb(readEv(id));
      return () => evListeners.get(id)?.delete(cb);
    },
    async getEvidence(id) {
      return readEv(id);
    },
    async saveEvidence(id, patch) {
      localStorage.setItem(EV + id, JSON.stringify({ ...(readEv(id) || {}), ...patch }));
      fireEv(id);
      channel?.postMessage({ t: 'ev', id });
    },
    // ── sesión local (sin Google) ──
    localLogin(userId) {
      const s = { userId };
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      ctx.setSession(s);
    },
    async logout() {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.setItem(SESSION_KEY, 'null');
      ctx.setSession(null);
    },
    exportAll: async () => {
      const evidence = {};
      for (const s of data.shipments) {
        const e = readEv(s.id);
        if (e) evidence[s.id] = e;
      }
      return { ...data, evidence };
    },
    importAll(json) {
      data = Object.fromEntries(COLS.map((c) => [c, json[c] || []]));
      for (const [id, e] of Object.entries(json.evidence || {})) localStorage.setItem(EV + id, JSON.stringify(e));
      persist();
    },
    resetAll() {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(EV))
        .forEach((k) => localStorage.removeItem(k));
      data = Object.fromEntries(COLS.map((c) => [c, []]));
      persist();
    },
  };
}
