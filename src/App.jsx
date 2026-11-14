import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, useSession, useSync, markRead, claimShipment, CLOUD, getViewRole, ROLE_LABEL } from './lib/store';
import AppLock from './components/AppLock';
import { ProfilePage, SettingsPage, AddressesPage, Avatar } from './views/Account';
import DriverApply from './views/DriverApply';
import { INTENT_KEY } from './views/Login';
import { BUSINESS_NAME, APP_VERSION } from './lib/config';
import { LogoMark } from './components/Logo';
import Login from './views/Login';
import ClientApp from './views/ClientApp';
import DriverApp from './views/DriverApp';
import AdminApp from './views/AdminApp';
import PublicPage from './views/PublicPage';
import { fmtClock } from './lib/geo';

// Enlace de consultora/destinatario: #/c/<envío>/<clave> → se guarda hasta que inicie sesión
const CLAIM_KEY = 'boxruta:claim';
{
  const m = location.hash.match(/^#\/c\/([^/]+)\/([^/]+)/);
  if (m) {
    sessionStorage.setItem(CLAIM_KEY, JSON.stringify({ id: m[1], token: m[2] }));
    history.replaceState(null, '', location.pathname + location.search + '#/home');
  }
}
const pendingClaim = () => {
  try {
    return JSON.parse(sessionStorage.getItem(CLAIM_KEY));
  } catch {
    return null;
  }
};

// Navegación simple con el hash de la URL (funciona con el botón "atrás" del celular)
function useView() {
  const parse = () => {
    const [name = 'home', id] = location.hash.replace('#/', '').split('/');
    return { name: name || 'home', id };
  };
  const [view, setView] = useState(parse);
  useEffect(() => {
    const h = () => setView(parse());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const go = (v) => {
    location.hash = `#/${v.name}${v.id ? '/' + v.id : ''}`;
    window.scrollTo(0, 0);
  };
  return [view, go];
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch {
    /* sin audio */
  }
}

/** Avisos: toast en pantalla + sonido + vibración + notificación del sistema */
function useNotifications(me, go) {
  const { notifications } = useStore();
  const { shipments } = useStore();
  const mine = useMemo(() => {
    const list = me ? notifications.filter((n) => n.userId === me.id) : [];
    // Repartidores: aviso local de cada envío nuevo disponible (no gasta escrituras en la nube)
    if (me?.role === 'driver' && me.online && me.approved)
      shipments
        .filter((s) => s.status === 'pending')
        .forEach((s) => list.push({ id: 'p_' + s.id, shipmentId: s.id, text: `Nuevo envío disponible: ${s.brand ? s.brand + ' · ' : ''}${s.dropoff?.address || ''}`, ts: s.updatedAt, read: true, local: true }));
    return list;
  }, [notifications, shipments, me]);
  const seen = useRef(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!me) return;
    if (seen.current === null) {
      seen.current = new Set(mine.map((n) => n.id));
      return;
    }
    const fresh = mine.filter((n) => !seen.current.has(n.id));
    fresh.forEach((n) => seen.current.add(n.id));
    if (!fresh.length) return;
    setToasts((t) => [...t, ...fresh].slice(-4));
    beep();
    navigator.vibrate?.(150);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      fresh.forEach((n) => new Notification(BUSINESS_NAME, { body: n.text, icon: './icon-192.png', tag: n.shipmentId }));
    }
    fresh.forEach((n) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 6000));
  }, [mine, me]);

  const open = (n) => {
    setToasts((t) => t.filter((x) => x.id !== n.id));
    if (n.shipmentId) go({ name: me.role === 'driver' ? (n.text.startsWith('Nuevo envío') ? 'home' : 'job') : 'track', id: n.shipmentId });
  };
  return { toasts, unread: mine.filter((n) => !n.read), all: mine.filter((n) => !n.local), open };
}

export default function App() {
  const session = useSession();
  const sync = useSync();
  const { users } = useStore();
  const me = users.find((u) => u.id === session?.userId);
  const [claim, setClaim] = useState(pendingClaim);
  const [view, go] = useView();
  const role = getViewRole(me);
  const meView = me ? { ...me, role } : null; // perfil activo (admin puede ver como repartidor o cliente)
  const { toasts, unread, all, open } = useNotifications(meView, go);
  const [bell, setBell] = useState(false);
  const [notifPerm, setNotifPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');

  // Vincular el envío del enlace a esta cuenta
  useEffect(() => {
    if (!me || !claim) return;
    sessionStorage.removeItem(CLAIM_KEY);
    setClaim(null);
    claimShipment(claim.id, claim.token)
      .then(() => setTimeout(() => go({ name: me.role === 'driver' ? 'home' : 'track', id: claim.id }), 600))
      .catch((e) => alert(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, claim]);

  // Entró por "Soy repartidor": llevarlo a su solicitud / código
  useEffect(() => {
    if (!me) return;
    let intent = null;
    try {
      intent = sessionStorage.getItem(INTENT_KEY);
      sessionStorage.removeItem(INTENT_KEY);
    } catch {
      /* sin almacenamiento */
    }
    if (intent === 'driver' && me.role !== 'driver' && me.role !== 'admin') go({ name: 'driver-apply' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  // Página pública para clientes sin la app (no requiere iniciar sesión)
  if (view.name === 't' && view.id) return <PublicPage token={view.id} />;
  if (!sync.ready) return <Splash />;
  if (!session || session.needsProfile) return <Login session={session} claim={!!claim} />;
  if (!me) return <Splash text="Cargando tu cuenta…" />;

  const shared = ['profile', 'settings', 'addresses', 'driver-apply'].includes(view.name);

  return (
    <AppLock me={me}>
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go({ name: 'home' })} aria-label="Inicio">
          <img src="./wordmark.png" alt="Envia2 express" className="wordmark" />
        </button>
        <button className="role-chip" onClick={() => go({ name: 'settings' })} title="Cambiar de perfil">
          {ROLE_LABEL[role]}
        </button>
        <div className="row gap top-actions">
          <button className="btn ghost icon bell" onClick={() => setBell(!bell)} aria-label="Notificaciones">
            🔔{!!unread.length && <span className="count">{unread.length}</span>}
          </button>
          <button className="avatar-btn" onClick={() => go({ name: 'profile' })} aria-label="Mi perfil">
            <Avatar me={me} size={36} />
          </button>
        </div>
        {bell && (
          <div className="bell-menu">
            <div className="row between">
              <b>Notificaciones</b>
              <button className="btn ghost sm" onClick={() => markRead(me.id)}>
                Marcar leídas
              </button>
            </div>
            {!all.length && <div className="muted sm">Sin notificaciones</div>}
            {[...all]
              .reverse()
              .slice(0, 20)
              .map((n) => (
                <button
                  key={n.id}
                  className={`notif ${n.read ? '' : 'unread'}`}
                  onClick={() => {
                    setBell(false);
                    open(n);
                  }}
                >
                  {n.text}
                  <small>{fmtClock(n.ts)}</small>
                </button>
              ))}
          </div>
        )}
      </header>

      <SyncBanner sync={sync} />
      <main>
        {view.name === 'profile' && <ProfilePage me={me} go={go} />}
        {view.name === 'settings' && <SettingsPage me={me} go={go} />}
        {view.name === 'addresses' && <AddressesPage me={me} />}
        {view.name === 'driver-apply' && <DriverApply me={me} go={go} />}
        {!shared && role === 'client' && <ClientApp me={meView} view={view} go={go} />}
        {!shared && role === 'driver' && <DriverApp me={meView} view={view} go={go} />}
        {!shared && role === 'admin' && <AdminApp me={meView} view={view} />}
        <div className="app-version">{BUSINESS_NAME} · versión {APP_VERSION}</div>
      </main>

      <BottomNav view={view} go={go} />

      <div className="toasts">
        {toasts.map((t) => (
          <button key={t.id} className="toast" onClick={() => open(t)}>
            {t.text}
          </button>
        ))}
      </div>
    </div>
    </AppLock>
  );
}

const NAV = [
  ['home', '🏠', 'Inicio'],
  ['orders', '📦', 'Pedidos'],
  ['history', '🕑', 'Historial'],
  ['addresses', '📍', 'Direcciones'],
  ['settings', '⚙️', 'Configuración'],
];
const NAV_OF = { new: 'home', quote: 'home', track: 'orders', job: 'orders', profile: 'settings', 'driver-apply': 'settings' };

/** Barra de menú inferior */
function BottomNav({ view, go }) {
  const cur = NAV_OF[view.name] || view.name;
  return (
    <nav className="bottom-nav" aria-label="Menú principal">
      {NAV.map(([k, icon, label]) => (
        <button key={k} className={cur === k ? 'on' : ''} onClick={() => go({ name: k })} aria-current={cur === k ? 'page' : undefined}>
          <span className="nav-icon">{icon}</span>
          <span className="nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Splash({ text = 'Cargando…' }) {
  return (
    <div className="splash">
      <LogoMark size={88} />
      <div className="muted">{text}</div>
    </div>
  );
}

/** Aviso de conexión: sin señal todo se guarda en el celular y se sube después */
function SyncBanner({ sync }) {
  if (!sync.online)
    return <div className="sync-banner off">📵 Sin señal — puedes seguir trabajando. Todo se guarda en el celular y se enviará al volver la conexión.</div>;
  if (CLOUD && sync.pending) return <div className="sync-banner pending">🔄 Sincronizando cambios…</div>;
  return null;
}
