import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, useSession, useSync, logout, markRead, claimShipment, CLOUD } from './lib/store';
import { BUSINESS_NAME, APP_VERSION } from './lib/config';
import Logo, { LogoMark } from './components/Logo';
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
  const { toasts, unread, all, open } = useNotifications(me, go);
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

  // Página pública para clientes sin la app (no requiere iniciar sesión)
  if (view.name === 't' && view.id) return <PublicPage token={view.id} />;
  if (!sync.ready) return <Splash />;
  if (!session || session.needsProfile) return <Login session={session} claim={!!claim} />;
  if (!me) return <Splash text="Cargando tu cuenta…" />;

  const roleName = { client: 'Cliente', driver: 'Repartidor', admin: 'Administrador' }[me.role];

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go({ name: 'home' })}>
          <Logo size={34} /> <small>{roleName}</small>
        </button>
        <div className="row gap">
          {notifPerm === 'default' && (
            <button className="btn ghost sm hide-sm" onClick={() => Notification.requestPermission().then(setNotifPerm)}>
              🔔 Activar avisos
            </button>
          )}
          <button className="btn ghost icon bell" onClick={() => setBell(!bell)} aria-label="Notificaciones">
            🔔{!!unread.length && <span className="count">{unread.length}</span>}
          </button>
          <button className="btn ghost sm" onClick={logout}>
            Salir
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
        {me.role === 'client' && <ClientApp me={me} view={view} go={go} />}
        {me.role === 'driver' && <DriverApp me={me} view={view} go={go} />}
        {me.role === 'admin' && <AdminApp me={me} />}
        <div className="app-version">{BUSINESS_NAME} · versión {APP_VERSION}</div>
      </main>

      <div className="toasts">
        {toasts.map((t) => (
          <button key={t.id} className="toast" onClick={() => open(t)}>
            {t.text}
          </button>
        ))}
      </div>
    </div>
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
