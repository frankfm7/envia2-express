import { useEffect, useRef, useState } from 'react';
import MapView from '../components/MapView';
import { AddressInput } from '../components/Common';
import { updateShipment, updateUser, ACTIVE, CLOUD } from '../lib/store';
import { getRoute, reverseGeocode, getCurrentPosition, distance, fmtKm } from '../lib/geo';
import { TIME_WINDOWS, BUSINESS_NAME } from '../lib/config';

const days = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      value: d.toISOString().slice(0, 10),
      label: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' }),
    };
  });

const windowStart = (date, w) => new Date(`${date}T${w.slice(0, 5)}:00`).getTime();

/**
 * La consultora / cliente confirma DÓNDE y A QUÉ HORA quiere recibir su caja.
 * Así el repartidor no va en vano.
 */
export function ConfirmMeeting({ s, me, back, editing, onDone, onBehalf }) {
  const [place, setPlace] = useState(s.dropoff || me.savedPlace || null);
  const [date, setDate] = useState(s.meeting?.date || days()[0].value);
  const [win, setWin] = useState(s.meeting?.window || '');
  const [reference, setReference] = useState(s.meeting?.reference || me.savedPlace?.reference || '');
  const [remember, setRemember] = useState(!onBehalf);
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const valid = place && win;

  const submit = async () => {
    setBusy(true);
    const tripRoute = s.pickup ? await getRoute(s.pickup, place) : null;
    if (remember && !onBehalf) updateUser(me.id, { savedPlace: { ...place, reference } });
    const meeting = { date, window: win, reference, confirmedAt: Date.now(), by: me.name };
    const text = `${s.code}: ${me.name} ${editing ? 'cambió' : 'confirmó'} la entrega para ${new Date(date + 'T12:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric' })} ${win} en ${place.address}`;
    updateShipment(
      s.id,
      { dropoff: place, meeting, tripRoute, scheduledAt: windowStart(date, win), ...(editing && ACTIVE.includes(s.status) && { route: null }) },
      {
        ...(s.status === 'awaiting_confirmation' && { status: 'pending', note: `Lugar y hora confirmados por ${me.name}` }),
        notify: [
          ...(s.status !== 'awaiting_confirmation' ? [{ to: s.clientId, text }] : []),
          { to: s.driverId, text: `📅 ${text}` },
        ],
      }
    );
    setBusy(false);
    onDone?.();
  };

  return (
    <div className={onBehalf ? '' : 'page'}>
      {!editing && !onBehalf && (
        <div className="page-head">
          <button className="btn ghost" onClick={back}>
            ← Volver
          </button>
          <h2>Confirma tu entrega</h2>
        </div>
      )}
      <div className="card hero-box">
        <div style={{ fontSize: 40 }}>📦</div>
        <div>
          <b>
            {s.brand ? `Tu caja ${s.brand}` : 'Tu caja'} {s.orderNo && `(pedido ${s.orderNo})`} ya llegó a {BUSINESS_NAME}
          </b>
          <div className="muted sm">
            {s.qty} caja(s) · Guía {s.code}
            {s.collectAmount ? ` · Monto a pagar al recibir: ${s.collectAmount}` : ''}
          </div>
        </div>
      </div>

      <div className="split">
        <div className="split-map">
          <MapView dropoff={place} pickup={null} height={300} onClick={async (p) => setPlace({ ...p, address: await reverseGeocode(p) })} />
          <p className="muted sm">Toca el mapa para marcar el punto exacto de entrega.</p>
        </div>
        <div className="split-form">
          <div className="card">
            <h3>📍 ¿Dónde te la entregamos?</h3>
            {me.savedPlace && place?.address !== me.savedPlace.address && (
              <button className="btn ghost sm" onClick={() => setPlace(me.savedPlace)}>
                ⭐ Usar mi lugar guardado
              </button>
            )}
            <AddressInput label="Dirección o punto de encuentro" value={place} onChange={setPlace} placeholder="Ej. Av. Principal 123, frente al mercado" />
            <div className="field">
              <label>Referencia</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej. casa verde, puerta negra, 2do piso" />
            </div>
            <label className="check" hidden={onBehalf}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Recordar este lugar para mis próximas cajas
            </label>
          </div>
          <div className="card">
            <h3>🕑 ¿Cuándo?</h3>
            <div className="chips">
              {days().map((d) => (
                <button key={d.value} type="button" className={`chip ${date === d.value ? 'on' : ''}`} onClick={() => setDate(d.value)}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className="win-grid">
              {TIME_WINDOWS.map((w) => {
                const past = new Date(`${date}T${w.slice(6)}:00`).getTime() < now;
                return (
                  <button key={w} type="button" disabled={past} className={`chip ${win === w ? 'on' : ''}`} onClick={() => setWin(w)}>
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn primary block lg sticky-cta" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Guardando…' : valid ? `✔ Confirmar ${win}` : 'Elige lugar y horario'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Cita acordada + botones "Voy en camino" / "Ya estoy en el punto" (comparte ubicación) */
export function MeetingStatus({ s, me, canEdit }) {
  const [edit, setEdit] = useState(false);
  const [sharing, setSharing] = useState(false);
  const watch = useRef(null);
  const last = useRef(0);

  useEffect(() => () => watch.current != null && navigator.geolocation.clearWatch(watch.current), []);

  const send = (pos, status) => {
    const d = s.dropoff ? Math.round(distance(pos, s.dropoff)) : null;
    updateShipment(
      s.id,
      { recipientPos: { lat: pos.lat, lng: pos.lng, ts: Date.now() }, recipientStatus: status },
      status !== s.recipientStatus ? { notify: [{ to: s.driverId, text: status === 'at_point' ? `🙋 ${me.name} ya está en el punto de entrega (${s.code})` : `🚶 ${me.name} va en camino al punto (${s.code})${d != null ? ` · a ${fmtKm(d)}` : ''}` }] } : {}
    );
  };

  const atPoint = async () => {
    const p = await getCurrentPosition();
    if (!p) return alert('Activa el GPS para compartir tu ubicación.');
    send(p, 'at_point');
  };
  const toggleShare = () => {
    if (sharing) {
      navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
      return setSharing(false);
    }
    setSharing(true);
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - last.current < (CLOUD ? 15000 : 3000)) return;
        last.current = Date.now();
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        const near = s.dropoff && distance(pos, s.dropoff) < 60;
        send(pos, near ? 'at_point' : 'on_way');
      },
      () => {
        alert('No se pudo usar el GPS.');
        setSharing(false);
      },
      { enableHighAccuracy: true }
    );
  };

  if (edit) return <ConfirmMeeting s={s} me={me} editing onDone={() => setEdit(false)} />;

  return (
    <div className="card meet-card">
      <div className="row between wrap gap">
        <div>
          <b>📅 Entrega acordada</b>
          <div>
            {new Date(s.meeting.date + 'T12:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })} · <b>{s.meeting.window}</b>
          </div>
          <div className="muted sm">
            {s.dropoff?.address} {s.meeting.reference && `· ${s.meeting.reference}`}
          </div>
        </div>
        {canEdit && !['arrived'].includes(s.status) && (
          <button className="btn ghost sm" onClick={() => setEdit(true)}>
            Cambiar lugar u hora
          </button>
        )}
      </div>
      {canEdit && (
        <div className="row gap wrap" style={{ marginTop: 10 }}>
          <button className={`btn ${sharing ? 'dark' : ''}`} onClick={toggleShare}>
            {sharing ? '⏹ Dejar de compartir ubicación' : '🚶 Voy en camino (compartir ubicación)'}
          </button>
          <button className="btn success" onClick={atPoint}>
            🙋 Ya estoy en el punto
          </button>
        </div>
      )}
      {s.recipientStatus && (
        <div className={`person-status ${s.recipientStatus}`}>
          {s.recipientStatus === 'at_point' ? `🙋 ${s.recipient.name} está en el punto de entrega` : `🚶 ${s.recipient.name} va en camino al punto`}
        </div>
      )}
    </div>
  );
}
