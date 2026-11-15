import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, sendMessage, markRead, ROLE_LABEL } from '../lib/store';
import { whatsappLink } from '../lib/config';
import { fmtClock } from '../lib/geo';
import { WhatsAppIcon } from './Common';

const QUICK = {
  driver: ['Voy en camino 🛵', 'Llego en 5 minutos ⏱️', 'Ya estoy afuera 🚪', 'Ten listo tu PIN 🔐'],
  client: ['¿Dónde vienes? 🙂', 'Ya estoy en el punto 🙋', 'Déjalo con el portero', 'Toca el timbre 🔔'],
};

/**
 * Mensajería básica dentro de la app (cuando ambos usan la app).
 * Con un toque se puede seguir la conversación en WhatsApp o llamar.
 */
export default function Chat({ s, me, other, height = 240 }) {
  const { messages } = useStore();
  const list = useMemo(() => messages.filter((m) => m.shipmentId === s.id), [messages, s.id]);
  const [text, setText] = useState('');
  const end = useRef(null);
  const closed = ['delivered', 'cancelled'].includes(s.status);
  // Un mensaje es "mío" si lo envié desde el MISMO perfil (sirve para probar con una sola cuenta como cliente y repartidor)
  const isMine = (m) => m.fromId === me.id && (!m.role || m.role === me.role);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    markRead(me.id, s.id);
  }, [list.length, me.id, s.id]);

  const send = (t) => {
    const v = (t ?? text).trim();
    if (!v) return;
    sendMessage(s.id, me, v);
    setText('');
  };

  return (
    <div className="chat">
      {other?.phone && (
        <div className="row between wrap gap chat-head">
          <b>💬 {other.name}</b>
          <div className="row gap">
            <a className="btn call sm" href={`tel:${other.phone}`}>
              📞
            </a>
            <a className="btn wa sm" href={whatsappLink(other.phone, `Hola ${other.name.split(' ')[0]}, te escribo por el envío ${s.code}.`)} target="_blank" rel="noreferrer">
              <WhatsAppIcon /> Ir a WhatsApp
            </a>
          </div>
        </div>
      )}
      <div className="chat-list" style={{ height }}>
        {!list.length && <div className="empty sm">Sin mensajes. Escribe aquí o usa WhatsApp.</div>}
        {list.map((m) => (
          <div key={m.id} className={`msg ${isMine(m) ? 'mine' : ''}`}>
            {!isMine(m) && (
              <div className="msg-name">
                {m.fromName} · {ROLE_LABEL[m.role] || ''}
              </div>
            )}
            <div>{m.text}</div>
            <div className="msg-time">{fmtClock(m.ts)}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {!closed && (
        <>
          <div className="chips">
            {QUICK[me.role === 'driver' ? 'driver' : 'client'].map((q) => (
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
        </>
      )}
    </div>
  );
}
