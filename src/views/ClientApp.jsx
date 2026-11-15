import { useEffect, useMemo, useRef, useState } from 'react';
import MapView from '../components/MapView';
import Receipt from '../components/Receipt';
import { ContactBar, Progress, StatusBadge, Timeline, Stars, Modal, WhatsAppIcon } from '../components/Common';
import Chat from '../components/Chat';
import { whatsappLink, pinMessage } from '../lib/config';
import NewShipment from './NewShipment';
import Quote from './Quote';
import HomeBanner from '../components/HomeBanner';
import { useStore, updateShipment, ACTIVE } from '../lib/store';
import { ConfirmMeeting, MeetingStatus } from './Meeting';
import { useEta, arrivalClock } from '../lib/useEta';
import { fmtKm, fmtMin, fmtDate } from '../lib/geo';
import { money, SIZES, PAYMENT_LABEL } from '../lib/config';
import { SERVICES, RULES as TRULES } from '../lib/tariff';
import { biometricConfirm, biometricAvailable } from '../lib/proof';

export default function ClientApp({ me, view, go }) {
  const { shipments } = useStore();
  const mine = useMemo(() => shipments.filter((s) => s.clientId === me.id || s.recipientUid === me.id), [shipments, me.id]);
  const prefill = useRef(null); // datos de la cotización aceptada → formulario de solicitud

  if (view.name === 'new')
    return (
      <NewShipment
        me={me}
        prefill={prefill.current}
        onCancel={() => go({ name: 'home' })}
        onDone={(id) => {
          prefill.current = null;
          go({ name: 'track', id });
        }}
      />
    );
  if (view.name === 'quote')
    return (
      <Quote
        role="client"
        onBack={() => go({ name: 'home' })}
        onAccept={(p) => {
          prefill.current = p;
          go({ name: 'new' });
        }}
      />
    );
  if (view.name === 'track') {
    const s = mine.find((x) => x.id === view.id);
    if (s) return <Track s={s} me={me} back={() => go({ name: 'orders' })} />;
  }

  const toConfirm = mine.filter((s) => s.status === 'awaiting_confirmation' && s.recipientUid === me.id);
  const active = mine.filter((s) => !toConfirm.includes(s) && (['pending', 'awaiting_confirmation', 'stored'].includes(s.status) || ACTIVE.includes(s.status)));
  const past = mine.filter((s) => !active.includes(s));

  const section = view.name === 'orders' ? 'orders' : view.name === 'history' ? 'history' : 'home';
  const open = (sh) => go({ name: 'track', id: sh.id });
  const List = ({ items, highlight }) => (
    <div className="list">
      {items.map((sh) => (
        <ShipmentCard key={sh.id} s={sh} onOpen={() => open(sh)} highlight={highlight} />
      ))}
    </div>
  );

  if (section === 'history')
    return (
      <div className="page">
        <h2>🕑 Historial</h2>
        {!past.length ? <div className="card empty">Aún no tienes envíos terminados.</div> : <List items={past} />}
      </div>
    );

  if (section === 'orders')
    return (
      <div className="page">
        <div className="row between wrap gap">
          <h2>📦 Mis pedidos</h2>
          <button className="btn primary" onClick={() => go({ name: 'new' })}>
            + Nuevo envío
          </button>
        </div>
        {!!toConfirm.length && (
          <>
            <h3 className="section-title">¡Llegaron tus cajas! Confirma dónde y cuándo</h3>
            <List items={toConfirm} highlight />
          </>
        )}
        {!active.length && !toConfirm.length ? <div className="card empty">No tienes pedidos en curso.</div> : <List items={active} />}
      </div>
    );

  return (
    <div className="page">
      <div className="hello">
        <div>
          <h2>Hola, {me.name.split(' ')[0]} 👋</h2>
          <p className="muted">¿Qué enviamos hoy?</p>
        </div>
      </div>
      <HomeBanner role="client" go={go} />
      <div className="home-actions">
        <button className="home-action primary" onClick={() => go({ name: 'new' })}>
          <span>📦</span>
          <b>Nuevo envío</b>
          <small>De A a B o mandado con compra</small>
        </button>
        <button className="home-action" onClick={() => go({ name: 'quote' })}>
          <span>💲</span>
          <b>¿Cuánto me cuesta?</b>
          <small>Cotiza antes de pedir</small>
        </button>
      </div>

      {!!toConfirm.length && (
        <>
          <h3 className="section-title">📦 ¡Llegaron tus cajas! Confirma dónde y cuándo</h3>
          <List items={toConfirm} highlight />
        </>
      )}
      {!!active.length && (
        <>
          <h3 className="section-title">En curso</h3>
          <List items={active.slice(0, 3)} />
          {active.length > 3 && (
            <button className="btn ghost block" onClick={() => go({ name: 'orders' })}>
              Ver todos mis pedidos ({active.length})
            </button>
          )}
        </>
      )}
      {!mine.length && (
        <div className="card empty-state">
          <div style={{ fontSize: 56 }}>📦</div>
          <h3>Aún no tienes envíos</h3>
          <p className="muted">Cotiza o crea tu primer envío. Verás al repartidor en el mapa en tiempo real.</p>
        </div>
      )}
      {!!past.length && (
        <button className="btn ghost block" onClick={() => go({ name: 'history' })}>
          🕑 Ver historial ({past.length})
        </button>
      )}
    </div>
  );
}

function ShipmentCard({ s, onOpen, highlight }) {
  const eta = useEta(s);
  return (
    <button className={`card ship-card ${highlight ? 'highlight' : ''}`} onClick={onOpen}>
      <div className="row between">
        <b>
          {s.brand && <span className="tag brand">{s.brand}</span>} {s.code}
        </b>
        <StatusBadge status={s.status} />
      </div>
      <div className="ship-route">
        {s.pickup && (
          <div>
            <span className="dot a">A</span> {s.pickup.address}
          </div>
        )}
        <div>
          <span className="dot b">B</span> {s.dropoff ? s.dropoff.address : 'Por confirmar: toca aquí para elegir lugar y hora'}
        </div>
      </div>
      <div className="row between muted sm">
        <span>
          {SIZES[s.size]?.icon} {s.qty} caja(s) · {money(s.price)}
        </span>
        <span>{eta && eta.seconds > 0 ? `Llega ~${arrivalClock(eta.seconds)}` : fmtDate(s.updatedAt)}</span>
      </div>
    </button>
  );
}

function Track({ s, me, back }) {
  const eta = useEta(s);
  const [tab, setTab] = useState('info');
  const [showReceipt, setShowReceipt] = useState(false);
  const [bio, setBio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  useEffect(() => {
    biometricAvailable().then(setBio);
  }, []);

  const hasDriver = !!s.driverId;
  const delivered = s.status === 'delivered';
  const isRecipient = s.recipientUid === me.id || (!s.recipientUid && s.selfRecipient && s.clientId === me.id);
  const isRecipientUser = s.recipientUid === me.id;
  const target = s.status === 'accepted' ? 'origen' : 'destino';

  const confirmBio = async () => {
    setBusy(true);
    try {
      const r = await biometricConfirm(me, `${s.code}|recibido|${Date.now()}`);
      updateShipment(s.id, { clientBiometric: r }, { notify: [{ to: s.driverId, text: `👆 ${me.name} confirmó con huella que recibió ${s.code}` }] });
    } catch (e) {
      alert('No se pudo verificar la huella: ' + (e.message || e));
    }
    setBusy(false);
  };

  if (s.status === 'awaiting_confirmation' && isRecipientUser) return <ConfirmMeeting s={s} me={me} back={back} />;

  return (
    <div className="page track">
      <div className="page-head">
        <button className="btn ghost" onClick={back}>
          ← Mis pedidos
        </button>
        <h2>{s.code}</h2>
        <StatusBadge status={s.status} />
      </div>

      <div className="split">
        <div className="split-map">
          <MapView
            pickup={s.pickup}
            dropoff={s.dropoff}
            person={!delivered ? s.recipientPos : null}
            driver={hasDriver && !delivered ? s.driverPos : null}
            route={delivered ? null : s.route || s.tripRoute}
            track={s.track}
            height={420}
          />
          {!delivered && !['cancelled', 'awaiting_confirmation'].includes(s.status) && (
            <div className="eta-card">
              {s.status === 'pending' ? (
                <>
                  <div className="pulse" />
                  <div>
                    <b>Buscando repartidor cercano…</b>
                    <div className="muted sm">Te avisaremos en cuanto alguien acepte tu envío.</div>
                  </div>
                </>
              ) : s.status === 'arrived' ? (
                <div>
                  <b className="big">🚪 ¡Tu repartidor llegó!</b>
                  <div className="muted">Dale este código para recibir tu caja:</div>
                </div>
              ) : (
                <>
                  <div className="eta-big">
                    <span className="muted sm">{s.status === 'accepted' ? `Llega al ${target} en` : 'Llega en'}</span>
                    <b>{fmtMin(s.status === 'accepted' ? eta?.pickupSeconds : eta?.seconds)}</b>
                  </div>
                  <div className="eta-meta">
                    <div>
                      <span className="muted sm">Hora estimada de entrega</span>
                      <b>{eta ? arrivalClock(eta.seconds) : '—'}</b>
                    </div>
                    <div>
                      <span className="muted sm">Distancia</span>
                      <b>{fmtKm(eta?.distance)}</b>
                    </div>
                  </div>
                </>
              )}
              {['accepted', 'picked_up', 'in_transit', 'arrived', 'pending'].includes(s.status) && (
                <div className="pin-box" title="Código de entrega">
                  <span className="muted sm">PIN de entrega</span>
                  <b>{s.pin}</b>
                </div>
              )}
            </div>
          )}
          {s.status !== 'cancelled' && <Progress shipment={s} />}
        </div>

        <div className="split-form">
          {s.status === 'stored' && <StoredCard s={s} />}
          {s.status === 'awaiting_confirmation' && !isRecipientUser && (
            <div className="alert warn">Esperando que {s.recipient.name} confirme lugar y hora de entrega.</div>
          )}
          {s.meeting && !delivered && s.status !== 'cancelled' && <MeetingStatus s={s} me={me} canEdit={isRecipientUser} />}
          {hasDriver && (
            <div className="card driver-card">
              <div className="avatar">{s.driverName?.[0]}</div>
              <div className="grow">
                <b>{s.driverName}</b>
                <div className="muted sm">
                  {s.vehicle} · {s.plate || 'sin placas'}
                </div>
              </div>
            </div>
          )}
          {hasDriver && !delivered && s.status !== 'cancelled' && (
            <div className="card">
              <Chat s={s} me={me} other={{ name: s.driverName, phone: s.driverPhone }} />
            </div>
          )}

          {delivered && (
            <div className="card success">
              <h3>✅ Entregado</h3>
              <p>
                Recibió <b>{s.proof?.receivedBy}</b> · {fmtDate(s.events.at(-1).ts)}
              </p>
              <div className="row gap wrap">
                <button className="btn primary" onClick={() => setShowReceipt(true)}>
                  📄 Ver / descargar comprobante
                </button>
                <button
                  className="btn"
                  disabled={!!s.receiptRequestedAt}
                  onClick={() =>
                    updateShipment(s.id, { receiptRequestedAt: Date.now() }, { notify: [{ to: s.driverId, text: `📩 ${me.name} pide su comprobante de ${s.code}. Envíalo desde tu Historial.` }] })
                  }
                >
                  {s.receiptRequestedAt ? '✔ Comprobante solicitado' : '📩 Pedir mi comprobante por WhatsApp'}
                </button>
              </div>
              {!s.clientBiometric ? (
                <div className="bio-box">
                  <p className="sm">Confirma que recibiste tu caja. Queda como respaldo firmado por tu teléfono.</p>
                  {bio ? (
                    <button className="btn dark" onClick={confirmBio} disabled={busy}>
                      👆 Confirmar con huella / Face ID
                    </button>
                  ) : (
                    <button
                      className="btn dark"
                      onClick={() =>
                        updateShipment(s.id, { clientBiometric: { method: 'boton', ts: Date.now(), verified: false } }, { notify: [{ to: s.driverId, text: `✔ ${me.name} confirmó que recibió ${s.code}` }] })
                      }
                    >
                      ✔ Confirmar recepción
                    </button>
                  )}
                </div>
              ) : (
                <p className="sm">👆 Recepción confirmada por ti el {fmtDate(s.clientBiometric.ts)}</p>
              )}
              {!s.rating ? (
                <div className="rate">
                  <b>¿Cómo fue tu entrega?</b>
                  <Stars value={rating} onChange={setRating} />
                  <input value={review} onChange={(e) => setReview(e.target.value)} placeholder="Comentario (opcional)" />
                  <button className="btn" disabled={!rating} onClick={() => updateShipment(s.id, { rating, review })}>
                    Enviar calificación
                  </button>
                </div>
              ) : (
                <div className="row gap">
                  <Stars value={s.rating} size={18} /> <span className="muted">¡Gracias!</span>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="tabs">
              <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>
                📦 Detalles
              </button>
              <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
                🕑 Historial
              </button>
            </div>
            {tab === 'info' && (
              <dl className="details">
                <dt>Recoger</dt>
                <dd>{s.pickup?.address || "—"}</dd>
                <dt>Entregar</dt>
                <dd>{s.dropoff?.address || "Por confirmar"}</dd>
                <dt>Recibe</dt>
                <dd>
                  {s.recipient.name} · {s.recipient.phone}
                </dd>
                <dt>Caja</dt>
                <dd>
                  {s.qty} × {SIZES[s.size]?.label} {s.weight && `· ${s.weight} kg`} {s.fragile && '· Frágil'} {s.express && '· Express'}
                </dd>
                {s.content && (
                  <>
                    <dt>Contenido</dt>
                    <dd>{s.content}</dd>
                  </>
                )}
                {s.scheduledAt && (
                  <>
                    <dt>Programado</dt>
                    <dd>{fmtDate(s.scheduledAt)}</dd>
                  </>
                )}
                <dt>Servicio</dt>
                <dd>
                  {SERVICES[s.service || 'simple'].icon} {SERVICES[s.service || 'simple'].label}
                  {s.purchase && <div className="sm">🛍️ {s.purchase}{s.purchaseAmount ? ` · aprox. ${money(s.purchaseAmount)}` : ''}</div>}
                </dd>
                {s.routeKm != null && (
                  <>
                    <dt>Ruta</dt>
                    <dd>{String(s.routeKm).replace('.', ',')} km (por calles)</dd>
                  </>
                )}
                <dt>Total</dt>
                <dd>
                  <b>{money(s.finalPrice ?? s.price)}</b> · {PAYMENT_LABEL[s.payment]}
                  {s.tariff?.lines && (
                    <div className="muted sm">
                      {s.tariff.lines.map((l) => `${l.label}: ${money(l.amount)}`).join(' · ')}
                    </div>
                  )}
                </dd>
                {s.notes && (
                  <>
                    <dt>Indicaciones</dt>
                    <dd>{s.notes}</dd>
                  </>
                )}
              </dl>
            )}
            {tab === 'history' && <Timeline shipment={s} />}
          </div>

          {!delivered && s.status !== 'cancelled' && (
            <div className="card">
              <h4>🔐 PIN para quien recibe</h4>
              {s.recipient.phone !== me.phone ? (
                <>
                  <p className="sm">
                    {s.recipient.name} necesita el PIN <b>{s.pin}</b> para recibir. Envíaselo por WhatsApp (incluye la advertencia de no compartirlo).
                  </p>
                  <a className="btn wa block" target="_blank" rel="noreferrer" href={whatsappLink(s.recipient.phone, pinMessage(s))}>
                    <WhatsAppIcon /> Enviar PIN a {s.recipient.name.split(' ')[0]}
                  </a>
                </>
              ) : (
                <p className="sm">Tú recibes: da el PIN <b>{s.pin}</b> solo al repartidor al recibir. No lo compartas.</p>
              )}
            </div>
          )}

          {['pending', 'accepted'].includes(s.status) && (
            <button
              className="btn danger ghost block"
              onClick={() => {
                const reason = prompt('¿Por qué cancelas el envío?');
                if (reason !== null) updateShipment(s.id, {}, { status: 'cancelled', note: reason || 'Cancelado por el cliente' });
              }}
            >
              Cancelar envío
            </button>
          )}
        </div>
      </div>
      {showReceipt && (
        <Modal title="Comprobante de entrega" onClose={() => setShowReceipt(false)} wide>
          <Receipt shipment={s} />
        </Modal>
      )}
    </div>
  );
}

/** Paquete en oficina: cargo por depósito y reenvío */
function StoredCard({ s }) {
  const days = Math.max(1, Math.ceil((Date.now() - (s.storedAt || Date.now())) / 864e5));
  const storage = days * TRULES.storagePerDay;
  return (
    <div className="card stored-card">
      <h3>🏢 Tu paquete está en oficina</h3>
      <p className="sm">
        No se pudo entregar{s.incident?.reason ? `: ${s.incident.reason}` : ''}. Depósito: Bs {TRULES.storagePerDay} por día (van {days} día{days > 1 ? 's' : ''}: <b>{money(storage)}</b>).
      </p>
      <button
        className="btn primary block"
        onClick={() => {
          if (!confirm(`¿Pedir reenvío? Se suman ${money(TRULES.redelivery)} de reenvío + ${money(storage)} de depósito.`)) return;
          const extra = TRULES.redelivery + storage;
          updateShipment(
            s.id,
            {
              price: (s.price || 0) + extra,
              redelivery: { at: Date.now(), redelivery: TRULES.redelivery, storage, days },
              tariff: { ...(s.tariff || {}), lines: [...(s.tariff?.lines || []), { label: 'Reenvío', amount: TRULES.redelivery }, { label: `Depósito ${days} día(s)`, amount: storage }] },
              driverId: null,
              driverPos: null,
              route: null,
              pickupArrivedAt: null,
              nearNotified: false,
            },
            { status: 'pending', note: 'Reenvío solicitado por el cliente' }
          );
        }}
      >
        🔁 Solicitar reenvío (+{money(TRULES.redelivery)})
      </button>
      <p className="muted sm">También puedes recogerlo en la oficina pagando el depósito.</p>
    </div>
  );
}
