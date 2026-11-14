import { useState } from 'react';
import { WhatsAppIcon } from './Common';
import { whatsappLink, pinMessage, BUSINESS_NAME } from '../lib/config';
import { getCurrentPosition } from '../lib/geo';
import { updateShipment, publishPublic, publicLink } from '../lib/store';

const wa = (phone, text) => window.open(whatsappLink(phone, text), '_blank');

/**
 * Toda la comunicación va por WhatsApp (sin chat dentro de la app):
 * PIN, ubicación en tiempo real, mensajes rápidos y llamadas.
 * WhatsApp no se puede meter DENTRO de otra app: cada botón abre el chat con el texto listo.
 */
export default function WhatsAppPanel({ s, me, to, etaMin, role = 'driver' }) {
  const [help, setHelp] = useState(false);
  if (!to?.phone) return null;
  const first = (to.name || '').split(' ')[0];

  const sendPin = () => {
    const withLink = !!s.publicToken;
    wa(to.phone, pinMessage(s, { driverName: role === 'driver' ? me.name : null, trackingLink: withLink ? publicLink(s) : null }));
    if (withLink && role === 'driver') publishPublic(s);
    updateShipment(s.id, { pinSentAt: Date.now() });
  };
  const myLocation = async () => {
    const p = (await getCurrentPosition()) || s.driverPos;
    if (!p) return alert('Activa el GPS para enviar tu ubicación.');
    wa(to.phone, `📍 Mi ubicación ahora: https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`);
  };
  const live = () => {
    setHelp(true);
    wa(to.phone, `Hola ${first}, te comparto mi ubicación en tiempo real para que veas cuándo llego 🛵👇`);
  };

  const quick =
    role === 'driver'
      ? [
          'Hola, voy en camino con tu paquete 🛵',
          etaMin ? `Llego en aproximadamente ${etaMin} minutos ⏱️` : 'Llego en unos minutos ⏱️',
          'Ya estoy afuera 🚪, ¿puedes salir por favor?',
          'No encuentro la dirección, ¿me envías tu ubicación? 📍',
          'Por favor ten listo tu PIN de entrega 🔐',
        ]
      : ['Hola, ¿dónde vienes? 🙂', 'Ya estoy en el punto de entrega 🙋', 'Déjalo con el portero por favor', 'Toca el timbre por favor 🔔'];

  return (
    <div className="wa-panel">
      <div className="row between wrap gap">
        <b>
          <WhatsAppIcon /> {to.label || first}
        </b>
        <a className="btn call sm" href={`tel:${to.phone}`}>
          📞 Llamar
        </a>
      </div>

      {role === 'driver' && (
        <button className={`btn block ${s.pinSentAt ? '' : 'wa lg'}`} onClick={sendPin}>
          🔐 {s.pinSentAt ? 'Reenviar PIN y seguimiento' : 'Enviar PIN y seguimiento por WhatsApp'}
        </button>
      )}
      {role === 'driver' && !s.pinSentAt && <div className="alert warn sm">El cliente necesita su PIN para recibir. Envíaselo antes de llegar.</div>}

      <div className="row gap wrap" style={{ marginTop: 8 }}>
        <button className="btn wa grow" onClick={live}>
          🟢 Ubicación en tiempo real
        </button>
        <button className="btn grow" onClick={myLocation}>
          📍 Mi ubicación ahora
        </button>
      </div>
      {help && (
        <div className="wa-help">
          <b>En WhatsApp:</b> toca <b>📎</b> (o <b>+</b> en iPhone) → <b>Ubicación</b> → <b>Compartir ubicación en tiempo real</b> → elige <b>1 hora</b> → enviar.
          <button className="btn ghost sm" onClick={() => setHelp(false)}>
            Entendido
          </button>
        </div>
      )}

      <div className="chips">
        {quick.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => wa(to.phone, q)}>
            {q}
          </button>
        ))}
      </div>
      <p className="muted sm">Los mensajes y llamadas se hacen por WhatsApp. {BUSINESS_NAME} no guarda conversaciones.</p>
    </div>
  );
}
