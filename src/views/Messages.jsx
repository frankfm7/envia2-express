import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, sendMessage, sendDirect, markRead, dmThread, supportThread, adminUids, ROLE_LABEL, ADMIN_INBOX, supportSeen, markSupportSeen } from '../lib/store';
import { fmtClock, fmtDate } from '../lib/geo';
import { whatsappLink, BUSINESS_NAME } from '../lib/config';
import { WhatsAppIcon } from '../components/Common';
import { Avatar } from './Account';

const QUICK = {
  admin: ['Hola, ¿en qué te ayudo?', 'Revisaremos tu caso ahora mismo', '¿Me confirmas el código del pedido?', '¡Gracias por tu paciencia!'],
  driver: ['Voy en camino 🛵', 'Llego en 5 minutos ⏱️', 'Ya estoy afuera 🚪', 'Necesito ayuda con un pedido'],
  client: ['Hola 👋', '¿Dónde viene mi pedido?', 'Necesito ayuda', '¡Gracias!'],
};

/**
 * MENSAJES: chats de cada pedido + chats directos.
 *  • Administrador: puede escribir a cualquier repartidor o cliente.
 *  • Cliente / repartidor: chat de "Soporte" con el administrador.
 */
export default function Messages({ me, go, openId }) {
  const { messages, shipments, users, notifications } = useStore();
  const [open, setOpen] = useState(openId || null);
  const [newChat, setNewChat] = useState(false);
  useEffect(() => setOpen(openId || null), [openId]);

  const admins = adminUids();
  const isAdmin = me.role === 'admin';
  const unreadOf = (key) =>
    notifications.filter((n) => n.userId === me.id && !n.read && n.shipmentId === key).length ||
    (isAdmin && key.startsWith('sup:') ? messages.filter((m) => m.threadId === key && m.role !== 'admin' && m.ts > supportSeen(key)).length : 0);

  // Conversaciones a partir de los mensajes
  const threads = useMemo(() => {
    const map = new Map();
    messages
      .filter((m) => (m.participants || []).includes(me.id) || (isAdmin && (m.participants || []).includes(ADMIN_INBOX)))
      .forEach((m) => {
        const key = m.threadId || m.shipmentId;
        if (!key) return;
        const t = map.get(key) || { key, last: m, count: 0 };
        t.count++;
        if (m.ts >= t.last.ts) t.last = m;
        map.set(key, t);
      });
    // pedidos activos (aunque aún no tengan mensajes)
    shipments
      .filter((s) => [s.clientId, s.driverId, s.recipientUid].includes(me.id) && !['delivered', 'cancelled'].includes(s.status) && s.driverId && s.clientId !== s.driverId)
      .forEach((s) => !map.has(s.id) && map.set(s.id, { key: s.id, last: null, count: 0 }));
    return [...map.values()].sort((a, b) => (b.last?.ts || 0) - (a.last?.ts || 0));
  }, [messages, shipments, me.id, isAdmin]);

  const titleOf = (key) => {
    if (key.startsWith('sup:')) {
      if (!isAdmin) return { title: `Soporte ${BUSINESS_NAME}`, sub: 'Administración', icon: '🛟' };
      const u = users.find((x) => x.id === key.slice(4));
      return { title: u?.name || 'Cliente', sub: `Soporte · ${ROLE_LABEL[u?.role] || ''}`, user: u };
    }
    if (key.startsWith('dm:')) {
      const otherId = key.slice(3).split('_').find((x) => x !== me.id);
      const u = users.find((x) => x.id === otherId);
      const m = messages.find((x) => x.threadId === key && x.fromId !== me.id);
      return { title: u?.name || m?.fromName || 'Conversación', sub: isAdmin ? ROLE_LABEL[u?.role] || '' : 'Administración', user: u, icon: u ? null : '🛟' };
    }
    const s = shipments.find((x) => x.id === key);
    const other = !s ? null : me.id === s.driverId ? s.clientName : s.driverName;
    return { title: other || 'Pedido', sub: s ? `Pedido ${s.code}` : 'Pedido', icon: '📦', shipment: s };
  };

  if (open) return <Thread me={me} go={go} k={open} info={titleOf(open)} onBack={() => setOpen(null)} admins={admins} users={users} />;

  const people = users.filter((u) => u.id !== me.id && u.role !== 'admin');
  return (
    <div className="page narrow">
      <div className="row between wrap gap">
        <h2>💬 Mensajes</h2>
        {isAdmin && (
          <button className="btn primary" onClick={() => setNewChat(!newChat)}>
            ✏️ Nuevo mensaje
          </button>
        )}
      </div>

      {isAdmin && newChat && <PeoplePicker people={people} onPick={(u) => (setNewChat(false), setOpen(dmThread(me.id, u.id)))} />}

      {!isAdmin && (
        <button className="thread-row support" onClick={() => setOpen(supportThread(me.id))}>
          <span className="thread-avatar">🛟</span>
          <span className="thread-text">
            <b>Soporte {BUSINESS_NAME}</b>
            <small>¿Dudas o problemas? Escríbenos aquí</small>
          </span>
          {unreadOf(supportThread(me.id)) > 0 && <span className="nav-badge static">{unreadOf(supportThread(me.id))}</span>}
        </button>
      )}

      {!threads.length && <div className="card empty">Aún no tienes conversaciones.{isAdmin ? ' Toca "Nuevo mensaje" para escribir a un repartidor o cliente.' : ''}</div>}
      <div className="thread-list">
        {threads
          .filter((t) => isAdmin || t.key !== supportThread(me.id))
          .map((t) => {
            const info = titleOf(t.key);
            const un = unreadOf(t.key);
            return (
              <button key={t.key} className={`thread-row ${un ? 'unread' : ''}`} onClick={() => setOpen(t.key)}>
                <span className="thread-avatar">{info.user ? <Avatar me={info.user} size={44} /> : info.icon || '💬'}</span>
                <span className="thread-text">
                  <b>{info.title}</b>
                  <small>
                    {info.sub}
                    {t.last ? ` · ${t.last.fromId === me.id ? 'Tú: ' : ''}${t.last.text}` : ' · sin mensajes'}
                  </small>
                </span>
                <span className="thread-meta">
                  {t.last && <small>{fmtClock(t.last.ts)}</small>}
                  {un > 0 && <span className="nav-badge static">{un}</span>}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function PeoplePicker({ people, onPick }) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('driver');
  const list = people.filter((u) => u.role === role && (!q || `${u.name} ${u.phone}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="card">
      <div className="seg">
        <button className={role === 'driver' ? 'on' : ''} onClick={() => setRole('driver')}>
          🛵 Repartidores
        </button>
        <button className={role === 'client' ? 'on' : ''} onClick={() => setRole('client')}>
          🙋 Clientes
        </button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o celular" />
      <div className="thread-list" style={{ marginTop: 8 }}>
        {list.slice(0, 50).map((u) => (
          <button key={u.id} className="thread-row" onClick={() => onPick(u)}>
            <span className="thread-avatar">
              <Avatar me={u} size={40} />
            </span>
            <span className="thread-text">
              <b>
                {u.role === 'driver' && <span className={`online-dot ${u.online ? 'on' : ''}`} />} {u.name}
              </b>
              <small>{u.phone}</small>
            </span>
          </button>
        ))}
        {!list.length && <p className="muted sm">Nadie encontrado.</p>}
      </div>
    </div>
  );
}

function Thread({ me, go, k, info, onBack, admins, users }) {
  const { messages } = useStore();
  const adminView = me.role === 'admin';
  const list = useMemo(
    () => messages.filter((m) => (m.threadId || m.shipmentId) === k && ((m.participants || []).includes(me.id) || (adminView && (m.participants || []).includes(ADMIN_INBOX)))).sort((a, b) => a.ts - b.ts),
    [messages, k, me.id, adminView]
  );
  const [text, setText] = useState('');
  const box = useRef(null);
  const isMine = (m) => m.fromId === me.id && (!m.role || m.role === me.role);
  useEffect(() => {
    // Se baja al último mensaje DENTRO de la conversación (sin mover la pantalla ni el menú de abajo)
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
    markRead(me.id, k);
    if (adminView && k.startsWith('sup:')) markSupportSeen(k);
  }, [list.length, k, me.id]);

  const otherUser = info.user || (k.startsWith('sup:') && me.role === 'admin' ? users.find((u) => u.id === k.slice(4)) : null);
  const participants = () => {
    if (k.startsWith('sup:')) return [k.slice(4), ADMIN_INBOX, ...admins];
    if (k.startsWith('dm:')) return k.slice(3).split('_');
    const s = info.shipment;
    return [s?.clientId, s?.driverId, s?.recipientUid];
  };
  const send = (t) => {
    const v = (t ?? text).trim();
    if (!v) return;
    if (k.startsWith('sup:') || k.startsWith('dm:')) sendDirect(k, me, participants(), v, info.title);
    else sendMessage(k, me, v);
    setText('');
  };

  return (
    <div className="page narrow thread-page">
      <div className="thread-head">
        <button className="btn ghost sm" onClick={onBack}>
          ←
        </button>
        <span className="thread-avatar">{otherUser ? <Avatar me={otherUser} size={40} /> : info.icon || '💬'}</span>
        <span className="thread-text">
          <b>{info.title}</b>
          <small>{info.sub}</small>
        </span>
        {otherUser?.phone && (
          <>
            <a className="btn call sm" href={`tel:${otherUser.phone}`} aria-label="Llamar">
              📞
            </a>
            <a className="btn wa sm" href={whatsappLink(otherUser.phone, `Hola ${otherUser.name.split(' ')[0]}`)} target="_blank" rel="noreferrer" aria-label="WhatsApp">
              <WhatsAppIcon />
            </a>
          </>
        )}
        {info.shipment && (
          <button className="btn ghost sm" onClick={() => go({ name: me.role === 'driver' ? 'job' : 'track', id: info.shipment.id })}>
            Ver pedido
          </button>
        )}
      </div>
      <div className="thread-msgs" ref={box}>
        {!list.length && <div className="empty sm">Escribe el primer mensaje 👋</div>}
        {list.map((m, i) => {
          const day = new Date(m.ts).toDateString();
          const prevDay = i ? new Date(list[i - 1].ts).toDateString() : null;
          return (
            <div key={m.id} className="msg-wrap">
              {day !== prevDay && <div className="day-sep">{fmtDate(m.ts).split(',')[0]}</div>}
              <div className={`msg ${isMine(m) ? 'mine' : ''}`}>
                {!isMine(m) && (
                  <div className="msg-name">
                    {m.fromName} · {ROLE_LABEL[m.role] || ''}
                  </div>
                )}
                <div>{m.text}</div>
                <div className="msg-time">{fmtClock(m.ts)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="chips">
        {(QUICK[me.role] || QUICK.client).map((q) => (
          <button key={q} type="button" className="chip" onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje…" aria-label="Mensaje" />
        <button className="btn primary" disabled={!text.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
