import { useEffect, useMemo, useRef, useState } from 'react';
import MapView from '../components/MapView';
import Receipt from '../components/Receipt';
import { ContactBar, StatusBadge, Modal, PhotoInput, Timeline } from '../components/Common';
import WhatsAppPanel from '../components/WhatsAppPanel';
import Chat from '../components/Chat';
import DeliveryProof from './DeliveryProof';
import { useStore, useSync, useEvidence, getState, updateShipment, updateUser, setDriverPosition, acceptShipment, saveEvidence, publishPublic, publicLink, ACTIVE, CLOUD, recipientHasApp, senderHasApp } from '../lib/store';
import DriverNewDelivery from './DriverNewDelivery';
import Quote from './Quote';
import { TariffCard } from '../components/Tariff';
import { sendReceiptLink } from '../lib/receiptImage';
import { claimLink } from './DeliveryProof';
import { useEta, arrivalClock } from '../lib/useEta';
import { distance, bearing, getRoute, remainingOnRoute, pointAlong, fmtKm, fmtMin, fmtDate, googleMapsLink, wazeLink, getCurrentPosition } from '../lib/geo';
import { SIZES, money, DELIVERY_RADIUS_M, PAYMENT_LABEL, whatsappLink, BUSINESS_NAME } from '../lib/config';
import { WhatsAppIcon } from '../components/Common';

const AUTO_ARRIVE_M = 80;
const NEAR_M = 1000; // aviso "tu repartidor está llegando"
// En la nube cada posición es una escritura: el plan gratis da 20.000 al día, así que espaciamos.
const WRITE_EVERY_MS = CLOUD ? 8000 : 2000;

// ─────────────────────────────────────────────────────────────────────────────
// Motor de rastreo: comparte la ubicación del repartidor con sus envíos activos.
// Modo "real" usa el GPS del teléfono; modo "simulación" recorre la ruta solo
// (útil para probar o hacer demostraciones desde la computadora).
// ─────────────────────────────────────────────────────────────────────────────
function useDriverTracker(me, jobs) {
  const current = jobs[0];
  const mode = me.gpsMode || 'real';
  const speed = me.simSpeed || 10;
  const sim = useRef({ routeKey: null, meters: 0 });
  const lastWrite = useRef(0);
  const lastReroute = useRef(0);
  const [gpsError, setGpsError] = useState('');

  const target = current && (current.status === 'accepted' ? current.pickup : ['picked_up', 'in_transit'].includes(current.status) ? current.dropoff : null);

  const writePos = (pos) => {
    getState()
      .shipments.filter((s) => s.driverId === me.id && ACTIVE.includes(s.status))
      .forEach((s) => setDriverPosition(s.id, pos, [...(s.track || []), [+pos.lat.toFixed(5), +pos.lng.toFixed(5)]].slice(-80)));
  };

  // 1) Calcular la ruta al objetivo actual (origen o destino)
  const routeFor = async (s, from) => {
    const to = s.status === 'accepted' ? s.pickup : s.dropoff;
    const route = await getRoute(from, to);
    route.key = `${s.id}:${s.status}:${Date.now()}`;
    route.target = s.status === 'accepted' ? 'pickup' : 'dropoff';
    const fresh = getState().shipments.find((x) => x.id === s.id);
    if (!fresh || !ACTIVE.includes(fresh.status)) return;
    updateShipment(s.id, { route }, fresh.status === 'picked_up' ? { status: 'in_transit' } : {});
  };

  useEffect(() => {
    if (!current || !target) return;
    const needs = !current.route || current.route.target !== (current.status === 'accepted' ? 'pickup' : 'dropoff');
    if (!needs) return;
    (async () => {
      let from = current.driverPos;
      if (!from) from = mode === 'real' ? await getCurrentPosition() : null;
      if (!from) from = { lat: current.pickup.lat + 0.011, lng: current.pickup.lng + 0.009 }; // punto de arranque de la demo
      writePos({ ...from, heading: bearing(from, target), ts: Date.now() });
      await routeFor(current, from);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.status]);

  // 2a) GPS real
  useEffect(() => {
    if (mode !== 'real' || !current || !navigator.geolocation) return;
    let prev = null;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGpsError('');
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, speed: p.coords.speed, ts: Date.now() };
        if (prev && distance(prev, pos) < 4 && Date.now() - lastWrite.current < 15000) return;
        pos.heading = p.coords.heading ?? (prev ? bearing(prev, pos) : 0);
        prev = pos;
        if (Date.now() - lastWrite.current < WRITE_EVERY_MS) return;
        lastWrite.current = Date.now();
        writePos(pos);
      },
      (e) => setGpsError(e.code === 1 ? 'Permiso de ubicación denegado. Actívalo en el navegador.' : 'No hay señal GPS.'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, current?.id]);

  // 2b) Simulación sobre la ruta
  useEffect(() => {
    if (mode !== 'sim' || !current?.route || !['accepted', 'in_transit'].includes(current.status)) return;
    const route = current.route;
    if (sim.current.routeKey !== route.key) sim.current = { routeKey: route.key, meters: 0 };
    const mps = (route.distance / Math.max(route.duration, 1)) * speed;
    const t = setInterval(() => {
      sim.current.meters += mps * (WRITE_EVERY_MS / 2000);
      const p = pointAlong(route.coords, sim.current.meters);
      writePos({ lat: p.lat, lng: p.lng, heading: p.heading, ts: Date.now(), simulated: true });
      if (p.done) clearInterval(t);
    }, WRITE_EVERY_MS / 2);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, speed, current?.route?.key, current?.status]);

  // 3) Llegada automática y recálculo si se sale de la ruta
  useEffect(() => {
    if (!current?.driverPos) return;
    const d = distance(current.driverPos, current.dropoff);
    if (current.status === 'in_transit' && d < NEAR_M && !current.nearNotified) {
      updateShipment(current.id, { nearNotified: true }, {
        notify: [current.clientId, current.recipientUid].filter(Boolean).map((to) => ({ to, text: `🛵 ${current.code}: tu repartidor está a menos de 1 km. ¡Prepárate para recibir!` })),
      });
    }
    // Hora de llegada al punto de recojo (para medir el tiempo de espera)
    if (current.status === 'accepted' && !current.pickupArrivedAt && current.pickup && distance(current.driverPos, current.pickup) < AUTO_ARRIVE_M) {
      updateShipment(current.id, { pickupArrivedAt: Date.now() });
    }
    if (current.status === 'in_transit' && d < AUTO_ARRIVE_M) {
      updateShipment(current.id, {}, { status: 'arrived', note: 'Llegada detectada por GPS' });
      navigator.vibrate?.([200, 100, 200]);
      return;
    }
    if (mode === 'real' && current.route && Date.now() - lastReroute.current > 30000) {
      const rem = remainingOnRoute(current.route, current.driverPos);
      if (rem?.offRoute) {
        lastReroute.current = Date.now();
        routeFor(current, current.driverPos);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.driverPos?.ts]);

  return { gpsError, mode };
}

export default function DriverApp({ me, view, go }) {
  const { shipments } = useStore();
  const jobs = useMemo(() => shipments.filter((s) => s.driverId === me.id && ACTIVE.includes(s.status)), [shipments, me.id]);
  const tracker = useDriverTracker(me, jobs);
  const prefill = useRef(null);
  usePublicSync(me, shipments);

  if (view.name === 'new') return <DriverNewDelivery me={me} prefill={prefill.current} onCancel={() => go({ name: 'home' })} onDone={(id) => ((prefill.current = null), go({ name: 'job', id }))} />;
  if (view.name === 'quote')
    return (
      <Quote
        onBack={() => go({ name: 'home' })}
        onCreate={(p) => {
          prefill.current = p;
          go({ name: 'new' });
        }}
      />
    );

  if (view.name === 'job') {
    const s = shipments.find((x) => x.id === view.id && x.driverId === me.id);
    if (s) return <Job s={s} me={me} back={() => go({ name: 'home' })} tracker={tracker} />;
  }
  return <DriverHome me={me} shipments={shipments} jobs={jobs} go={go} tracker={tracker} />;
}

function DriverHome({ me, shipments, jobs, go, tracker }) {
  if (!me.approved)
    return (
      <div className="page">
        <div className="card empty-state">
          <div style={{ fontSize: 56 }}>⏳</div>
          <h3>Tu cuenta de repartidor está en revisión</h3>
          <p className="muted">El administrador debe aprobarte desde su panel. Cuando lo haga, verás aquí los envíos disponibles.</p>
        </div>
      </div>
    );
  return <DriverHomeInner me={me} shipments={shipments} jobs={jobs} go={go} tracker={tracker} />;
}

function DriverHomeInner({ me, shipments, jobs, go, tracker }) {
  const sync = useSync();
  const [here, setHere] = useState(null);
  const outbox = useMemo(
    () => shipments.filter((s) => s.driverId === me.id && s.status === 'delivered' && !s.receiptSent?.recipient && s.updatedAt > Date.now() - 7 * 864e5),
    [shipments, me.id]
  );
  // Aviso al volver la señal
  const wasOnline = useRef(sync.online);
  useEffect(() => {
    if (sync.online && !wasOnline.current && outbox.length) {
      navigator.vibrate?.([150, 80, 150]);
      if ('Notification' in window && Notification.permission === 'granted')
        new Notification('Volvió la señal 📶', { body: `Tienes ${outbox.length} comprobante(s) por enviar a tus clientes`, icon: './icon-192.png' });
    }
    wasOnline.current = sync.online;
  }, [sync.online, outbox.length]);
  useEffect(() => {
    getCurrentPosition().then(setHere);
  }, []);
  const ref = jobs[0]?.driverPos || here;

  const available = useMemo(
    () =>
      shipments
        .filter((s) => s.status === 'pending')
        .map((s) => ({ ...s, away: ref ? distance(ref, s.pickup) : null }))
        .sort((a, b) => (a.away ?? 0) - (b.away ?? 0)),
    [shipments, ref]
  );
  const done = shipments.filter((s) => s.driverId === me.id && s.status === 'delivered');
  const today = done.filter((s) => new Date(s.updatedAt).toDateString() === new Date().toDateString());
  const ratings = done.filter((s) => s.rating);
  const avg = ratings.length ? (ratings.reduce((a, s) => a + s.rating, 0) / ratings.length).toFixed(1) : '—';
  const cash = today.reduce((a, s) => a + (s.proof?.cashCollected || 0), 0);

  return (
    <div className="page">
      <div className="card online-card">
        <div>
          <h2>Hola, {me.name.split(' ')[0]} 🛵</h2>
          <div className="muted sm">
            {me.vehicle} · {me.plate || 'sin placas'}
          </div>
        </div>
        <label className="switch">
          <input type="checkbox" checked={!!me.online} onChange={(e) => updateUser(me.id, { online: e.target.checked })} />
          <span />
          <b>{me.online ? 'En línea' : 'Desconectado'}</b>
        </label>
      </div>

      <div className="row gap" style={{ marginBottom: 12 }}>
        <button className="btn primary lg grow" onClick={() => go({ name: 'new' })}>
          ➕ Nueva entrega
        </button>
        <button className="btn lg" onClick={() => go({ name: 'quote' })}>
          💲 Cotizar
        </button>
      </div>

      {!!outbox.length && (
        <div className="card outbox">
          <h3>📤 Comprobantes por enviar ({outbox.length})</h3>
          <p className="muted sm">
            {sync.online
              ? '📶 Tienes señal: envía la copia firmada a cada cliente con un toque.'
              : '📵 Sin señal. Tus constancias están guardadas en el celular; envíalas cuando vuelva la señal (te avisaremos).'}
          </p>
          {outbox.map((s) => (
            <OutboxItem key={s.id} s={s} online={sync.online} onOpen={() => go({ name: 'job', id: s.id })} />
          ))}
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <span>Entregas hoy</span>
          <b>{today.length}</b>
        </div>
        <div className="stat">
          <span>Ganado hoy</span>
          <b>{money(today.reduce((a, s) => a + (s.finalPrice ?? s.price ?? 0), 0))}</b>
        </div>
        <div className="stat">
          <span>Efectivo a rendir</span>
          <b>{money(cash)}</b>
        </div>
        <div className="stat">
          <span>Calificación</span>
          <b>★ {avg}</b>
        </div>
      </div>

      <div className="card gps-card">
        <b>📡 Ubicación</b>
        <div className="seg">
          <button className={tracker.mode === 'real' ? 'on' : ''} onClick={() => updateUser(me.id, { gpsMode: 'real' })}>
            GPS real del teléfono
          </button>
          <button className={tracker.mode === 'sim' ? 'on' : ''} onClick={() => updateUser(me.id, { gpsMode: 'sim' })}>
            Simulación (demo)
          </button>
        </div>
        {tracker.mode === 'sim' && (
          <div className="row gap sm">
            Velocidad:
            {[1, 5, 10, 30].map((x) => (
              <button key={x} className={`chip ${(me.simSpeed || 10) === x ? 'on' : ''}`} onClick={() => updateUser(me.id, { simSpeed: x })}>
                ×{x}
              </button>
            ))}
          </div>
        )}
        {tracker.gpsError && <div className="alert warn">{tracker.gpsError}</div>}
      </div>

      <TariffCard forDriver />

      {!!jobs.length && <h3 className="section-title">Mis entregas activas</h3>}
      <div className="list">
        {jobs.map((s) => (
          <JobCard key={s.id} s={s} onOpen={() => go({ name: 'job', id: s.id })} />
        ))}
      </div>

      <h3 className="section-title">Envíos disponibles {me.online ? `(${available.length})` : ''}</h3>
      {!me.online ? (
        <div className="card empty">Conéctate para ver y aceptar envíos.</div>
      ) : !available.length ? (
        <div className="card empty">
          <div className="pulse inline" /> Esperando nuevos envíos…
        </div>
      ) : (
        <div className="list">
          {available.map((s) => (
            <div key={s.id} className="card ship-card">
              <div className="row between">
                <b>
                  {s.brand ? <span className="tag brand">{s.brand}</span> : SIZES[s.size]?.icon} {s.qty} × {SIZES[s.size]?.label} {s.express && <span className="tag">⚡ Express</span>}{' '}
                  {s.fragile && <span className="tag">Frágil</span>}
                </b>
                <b className="price">
                  {s.service === 'errand' && <span className="tag">🛍️ Mandado</span>} {s.price ? money(s.price) : PAYMENT_LABEL.prepaid}
                </b>
              </div>
              <div className="ship-route">
                <div>
                  <span className="dot a">A</span> {s.pickup.address} {s.away != null && <span className="muted sm">· a {fmtKm(s.away)} de ti</span>}
                </div>
                <div>
                  <span className="dot b">B</span> {s.dropoff.address}
                </div>
              </div>
              <div className="row between">
                <span className="muted sm">
                  Viaje {fmtKm(s.tripRoute?.distance)} · {fmtMin(s.tripRoute?.duration)}
                  {s.meeting && (
                    <b className="when">
                      {' '}
                      · 📅 {new Date(s.meeting.date + 'T12:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} {s.meeting.window}
                    </b>
                  )}
                  {!s.meeting && s.scheduledAt && ` · Programado ${fmtDate(s.scheduledAt)}`}
                </span>
                <button
                  className="btn primary"
                  onClick={async () => {
                    try {
                      if (await acceptShipment(s.id, me)) go({ name: 'job', id: s.id });
                      else alert('Otro repartidor ya tomó este envío.');
                    } catch (e) {
                      alert(e.message);
                    }
                  }}
                >
                  Aceptar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!!done.length && (
        <>
          <h3 className="section-title">Entregados</h3>
          <div className="list">
            {done.slice(0, 15).map((s) => (
              <JobCard key={s.id} s={s} onOpen={() => go({ name: 'job', id: s.id })} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function JobCard({ s, onOpen }) {
  const eta = useEta(s);
  return (
    <button className="card ship-card" onClick={onOpen}>
      <div className="row between">
        <b>
          {s.code} · {s.recipient.name}
        </b>
        <StatusBadge status={s.status} />
      </div>
      <div className="ship-route">
        <div>
          <span className={`dot ${s.status === 'accepted' ? 'a' : 'b'}`}>{s.status === 'accepted' ? 'A' : 'B'}</span>
          {s.status === 'accepted' ? s.pickup.address : s.dropoff.address}
        </div>
      </div>
      <div className="muted sm">{eta && eta.seconds > 0 ? `Llegada ~${arrivalClock(s.status === 'accepted' ? eta.pickupSeconds : eta.seconds)}` : fmtDate(s.updatedAt)}</div>
    </button>
  );
}

function Job({ s, me, back, tracker }) {
  const eta = useEta(s);
  const [modal, setModal] = useState(null);
  const [pickupPhoto, setPickupPhoto] = useState(null);
  const [tab, setTab] = useState('info');
  const toPickup = s.status === 'accepted';
  const target = toPickup ? s.pickup : s.dropoff;
  const active = ACTIVE.includes(s.status);
  const distTarget = s.driverPos ? distance(s.driverPos, target) : null;
  const etaMin = eta?.seconds ? Math.max(1, Math.round(eta.seconds / 60)) : null;

  return (
    <div className="page job">
      <div className="page-head">
        <button className="btn ghost" onClick={back}>
          ← Inicio
        </button>
        <h2>{s.code}</h2>
        <StatusBadge status={s.status} />
      </div>
      <div className="split">
        <div className="split-map">
          <MapView
            pickup={s.pickup}
            dropoff={s.dropoff}
            driver={active ? s.driverPos : null}
            route={active ? s.route : null}
            track={s.track}
            person={active && s.recipientPos ? s.recipientPos : null}
            follow={active && tracker.mode === 'real'}
            radius={s.status === 'arrived' || s.status === 'in_transit' ? DELIVERY_RADIUS_M : null}
            height={440}
          />
          {active && (
            <div className="nav-card">
              <div className="grow">
                <span className="muted sm">{toPickup ? 'Ve a recoger a' : 'Entregar en'}</span>
                <b className="addr-line">{target.address}</b>
                <div className="row gap sm">
                  <span>⏱ {fmtMin(toPickup ? eta?.pickupSeconds : eta?.seconds)}</span>
                  <span>📏 {fmtKm(distTarget)}</span>
                  {s.driverPos?.simulated && <span className="tag">Simulación</span>}
                  {s.route?.approx && <span className="tag">Ruta aprox.</span>}
                </div>
              </div>
              <div className="col gap">
                <a className="btn dark sm" href={googleMapsLink(target)} target="_blank" rel="noreferrer">
                  Google Maps
                </a>
                <a className="btn dark sm" href={wazeLink(target)} target="_blank" rel="noreferrer">
                  Waze
                </a>
              </div>
            </div>
          )}

          {s.status === 'accepted' && (
            <button className="btn primary block lg" onClick={() => setModal('pickup')}>
              📦 Recogí la caja
            </button>
          )}
          {s.status === 'in_transit' && (
            <button className="btn primary block lg" onClick={() => updateShipment(s.id, {}, { status: 'arrived', note: 'Marcado por el repartidor', pos: s.driverPos })}>
              🚪 Llegué al destino
            </button>
          )}
          {s.status === 'arrived' && (
            <button className="btn success block lg" onClick={() => setModal('deliver')}>
              ✍️ Confirmar entrega (PIN · foto · firma)
            </button>
          )}
          {active && s.meeting && (
            <div className="card meet-card">
              <b>📅 Cita acordada:</b> {new Date(s.meeting.date + 'T12:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })} · {s.meeting.window}
              {s.meeting.reference && <div className="sm">📝 {s.meeting.reference}</div>}
              {s.recipientStatus && (
                <div className={`person-status ${s.recipientStatus}`}>
                  {s.recipientStatus === 'at_point' ? '🙋 ' + s.recipient.name + ' ya está en el punto de entrega' : '🚶 ' + s.recipient.name + ' va en camino al punto'}
                  {s.recipientPos && s.driverPos && ` · a ${fmtKm(distance(s.recipientPos, s.driverPos))} de ti`}
                </div>
              )}
            </div>
          )}
          {s.status === 'delivered' && (
            <button className="btn primary block lg" onClick={() => setModal('receipt')}>
              🧾 Comprobante · enviar por WhatsApp
            </button>
          )}
          {active && (
            <button
              className="btn ghost danger block sm"
              onClick={() => {
                const reason = prompt('Motivo del problema (se avisará al cliente):', 'Nadie recibe en el domicilio');
                if (!reason) return;
                updateShipment(s.id, { incident: { reason, ts: Date.now(), pos: s.driverPos } }, { status: 'cancelled', note: `Incidencia: ${reason}` });
                back();
              }}
            >
              Reportar problema / no se pudo entregar
            </button>
          )}
        </div>

        <div className="split-form">
          {s.status !== 'delivered' && s.status !== 'cancelled' && (
            <div className="card">
              {recipientHasApp(s) || senderHasApp(s) ? (
                <>
                  <Chat
                    s={s}
                    me={me}
                    other={recipientHasApp(s) ? { name: s.recipient.name, phone: s.recipient.phone } : { name: s.clientName, phone: s.clientPhone }}
                  />
                  <details className="comm-more">
                    <summary>Opciones de WhatsApp (PIN, ubicación en tiempo real)</summary>
                    <WhatsAppPanel s={s} me={me} to={{ name: s.recipient.name, phone: s.recipient.phone, label: `${s.recipient.name} (recibe)` }} etaMin={etaMin} />
                  </details>
                </>
              ) : (
                <>
                  <div className="muted sm" style={{ marginBottom: 8 }}>
                    📵 {s.recipient.name} no usa la app: la comunicación es por WhatsApp.
                  </div>
                  <WhatsAppPanel s={s} me={me} to={{ name: s.recipient.name, phone: s.recipient.phone, label: `${s.recipient.name} (recibe)` }} etaMin={etaMin} />
                </>
              )}
              {s.clientId !== s.driverId && s.clientPhone && s.clientPhone !== s.recipient.phone && (
                <div className="row between wrap gap sender-row">
                  <span className="sm">
                    Remitente: <b>{s.clientName}</b>
                  </span>
                  <ContactBar name={s.clientName} phone={s.clientPhone} shipment={s} compact />
                </div>
              )}
            </div>
          )}
          <div className="card">
            <div className="tabs">
              <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>
                📦 Paquete
              </button>
              <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
                🕑 Historial
              </button>
            </div>
            {tab === 'info' && (
              <dl className="details">
                <dt>Caja</dt>
                <dd>
                  {s.qty} × {SIZES[s.size]?.label} {s.weight && `· ${s.weight} kg`} {s.fragile && '· ⚠️ Frágil'}
                </dd>
                {s.content && (
                  <>
                    <dt>Contenido</dt>
                    <dd>{s.content}</dd>
                  </>
                )}
                <dt>Cobro</dt>
                <dd>
                  <b>{money(s.price)}</b> {s.payment === 'cash' ? '· Cobrar en efectivo' : '· Ya pagado / transferencia'}
                  {s.routeKm != null && <div className="muted sm">Ruta {String(s.routeKm).replace('.', ',')} km{s.kmManual ? ' (medido en Google Maps)' : ''}</div>}
                  {s.service === 'errand' && (
                    <div className="sm">
                      🛍️ Comprar: <b>{s.purchase}</b> {s.purchaseAmount ? `· aprox. ${money(s.purchaseAmount)}` : ''}
                    </div>
                  )}
                </dd>
                {s.notes && (
                  <>
                    <dt>Indicaciones</dt>
                    <dd>{s.notes}</dd>
                  </>
                )}
                <dt>Origen</dt>
                <dd>{s.pickup.address}</dd>
                <dt>Destino</dt>
                <dd>{s.dropoff.address}</dd>
              </dl>
            )}
            {tab === 'history' && <Timeline shipment={s} />}
          </div>
        </div>
      </div>

      {modal === 'pickup' && (
        <Modal title="Confirmar recolección" onClose={() => setModal(null)}>
          <p>
            Revisa que sean <b>{s.qty}</b> caja(s) en buen estado y toma una foto como respaldo.
          </p>
          <PhotoInput value={pickupPhoto} onChange={setPickupPhoto} label="Foto de la(s) caja(s)" />
          <button
            className="btn primary block lg"
            disabled={!pickupPhoto}
            onClick={() => {
              saveEvidence(s.id, { pickupPhoto });
              updateShipment(s.id, { pickupProof: { ts: Date.now(), pos: s.driverPos || null }, route: null }, { status: 'picked_up', pos: s.driverPos });
              setModal(null);
            }}
          >
            Confirmar: caja recogida
          </button>
        </Modal>
      )}
      {modal === 'deliver' && (
        <Modal title="Prueba de entrega" onClose={() => setModal(null)}>
          <DeliveryProof s={s} me={me} onCancel={() => setModal(null)} onDone={() => setModal('receipt')} />
        </Modal>
      )}
      {modal === 'receipt' && s.status === 'delivered' && (
        <Modal title="Comprobante de entrega" onClose={() => setModal(null)} wide>
          <Receipt shipment={s} />
        </Modal>
      )}
    </div>
  );
}

/** Un comprobante pendiente de enviar al cliente */
function OutboxItem({ s, online, onOpen }) {
  const ev = useEvidence(s.id);
  return (
    <div className="outbox-item">
      <button className="btn ghost sm" onClick={onOpen} style={{ textAlign: 'left' }}>
        <b>{s.recipient.name}</b> · {s.code}
      </button>
      <button
        className="btn wa sm"
        disabled={ev === undefined}
        onClick={() => {
          sendReceiptLink(s, publicLink(s), s.recipient.phone);
          publishPublic(s, ev);
          updateShipment(s.id, { receiptSent: { ...(s.receiptSent || {}), recipient: Date.now() } });
        }}
      >
        <WhatsAppIcon /> {online ? 'Enviar' : 'Enviar (al volver señal)'}
      </button>
    </div>
  );
}

/**
 * Mantiene actualizada la página pública de seguimiento de cada entrega activa
 * (para clientes sin la app). En la nube se actualiza cada 30 s para ahorrar escrituras.
 */
function usePublicSync(me, shipments) {
  const last = useRef({});
  useEffect(() => {
    const now = Date.now();
    for (const s of shipments) {
      if (s.driverId !== me.id || !s.publicToken) continue;
      const l = last.current[s.id];
      if (s.status === 'delivered') continue; // se publica con las evidencias al confirmar la entrega
      if (s.status === 'cancelled') {
        if (l && l.status !== 'cancelled') publishPublic(s);
        last.current[s.id] = { status: s.status, ts: now };
        continue;
      }
      if (!ACTIVE.includes(s.status)) continue;
      const moved = s.driverPos?.ts !== l?.posTs;
      if (!l || l.status !== s.status || (moved && now - l.ts > (CLOUD ? 30000 : 3000))) {
        last.current[s.id] = { status: s.status, ts: now, posTs: s.driverPos?.ts };
        publishPublic(s);
      }
    }
  }, [shipments, me.id]);
}
