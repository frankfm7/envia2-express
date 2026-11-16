import { useEffect, useState } from 'react';
import { updateShipment } from '../lib/store';
import { waitInfo, fmtClockSec, WAIT_LABEL, shipmentTotal } from '../lib/wait';
import { money } from '../lib/config';

/**
 * Tiempo de espera (recojo o entrega), visible para el REPARTIDOR y el CLIENTE.
 * • Corre desde que el repartidor tocó "Esperando…" hasta recoger / entregar.
 * • Primero el tiempo gratis; si se pasa, muestra el recargo.
 * • El repartidor puede "Perdonar espera" (condonar) o volver a "Cobrar espera". El cliente lo ve al instante.
 */
export default function WaitBox({ s, which, driver = false }) {
  const [now, setNow] = useState(Date.now());
  const info = waitInfo(s, which, now);
  useEffect(() => {
    if (!info?.running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [info?.running]);
  if (!info) return null;
  const setWaived = (v) => {
    const ns = { ...s, waitWaived: { ...(s.waitWaived || {}), [which]: v } };
    const total = shipmentTotal(ns);
    updateShipment(
      s.id,
      { waitWaived: { ...(s.waitWaived || {}), [which]: v } },
      {
        notify: [s.clientId, s.recipientUid].filter(Boolean).map((to) => ({
          to,
          text: v ? `🤝 ${s.code}: el repartidor condonó la espera ${WAIT_LABEL[which]}. Pagas solo ${money(total)}.` : `⏳ ${s.code}: se cobrará la espera ${WAIT_LABEL[which]} si pasa del tiempo gratis.`,
        })),
      }
    );
  };
  const title = info.running ? (driver ? (which === 'pickup' ? 'Esperando el paquete' : 'Esperando para entregar') : which === 'pickup' ? 'El repartidor está esperando en el recojo' : 'El repartidor te está esperando') : `Espera ${WAIT_LABEL[which]}`;
  return (
    <div className={`wait-timer ${info.waived ? 'waived' : info.over ? 'over' : ''}`}>
      <span>⏳ {title}</span>
      <b>{fmtClockSec(info.seconds)}</b>
      <small>
        {info.waived
          ? '🤝 Espera condonada: no se cobra'
          : !info.over
            ? info.running
              ? `Tiempo de espera gratis: quedan ${Math.ceil(info.freeLeft)} min`
              : 'Dentro del tiempo gratis'
            : `Recargo por espera: ${money(info.amount)} (pasó los ${info.free} min gratis)`}
      </small>
      {driver && (info.over || info.waived) && (
        <div className="wait-actions">
          <button type="button" className={`btn sm ${!info.waived ? 'primary' : 'ghost'}`} onClick={() => setWaived(false)}>
            💰 Cobrar espera
          </button>
          <button type="button" className={`btn sm ${info.waived ? 'success' : 'ghost'}`} onClick={() => setWaived(true)}>
            🤝 Perdonar espera
          </button>
        </div>
      )}
      {driver && !info.over && !info.waived && info.running && (
        <div className="wait-actions">
          <button type="button" className="btn ghost sm" onClick={() => setWaived(true)}>
            🤝 No cobrar esta espera
          </button>
        </div>
      )}
    </div>
  );
}
