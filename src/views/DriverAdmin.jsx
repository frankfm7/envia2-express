import { useEffect, useMemo, useState } from 'react';
import { Modal, ContactBar, WhatsAppIcon } from '../components/Common';
import { useStore, getOne, approveDriverApp, rejectDriverApp, updateUser, notifyUser, ACTIVE, STATUS, removeDriverAccount } from '../lib/store';
import { whatsappLink } from '../lib/config';
import { fmtDate } from '../lib/geo';
import { codeLink } from './DriverApply';
import { Avatar } from './Account';

/** Administrador: revisar solicitudes de repartidores y dar el código de ingreso */
export default function DriverAdmin() {
  const { users, shipments } = useStore();
  const [open, setOpen] = useState(null);
  const pending = users.filter((u) => u.driverStatus === 'pending');
  const waitingCode = users.filter((u) => u.driverStatus === 'code_sent');
  const drivers = users.filter((u) => u.role === 'driver');
  const stats = useMemo(() => {
    const m = {};
    shipments.filter((s) => s.status === 'delivered').forEach((s) => {
      const x = (m[s.driverId] ||= { n: 0, r: [], month: 0 });
      x.n++;
      const d = new Date(s.updatedAt);
      const now = new Date();
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) x.month++;
      if (s.rating) x.r.push(s.rating);
    });
    return m;
  }, [shipments]);

  return (
    <div>
      <div className="card">
        <h3>📝 Solicitudes nuevas {pending.length ? `(${pending.length})` : ''}</h3>
        {!pending.length && <p className="muted sm">No hay solicitudes pendientes.</p>}
        {pending.map((u) => (
          <div key={u.id} className="row between wrap gap driver-row">
            <span className="row gap">
              <Avatar me={u} size={40} />
              <span>
                <b>{u.driverApp?.fullName || u.name}</b>
                <div className="muted sm">
                  CI {u.driverApp?.ci} · {u.driverApp?.vehicle} {u.driverApp?.plate} · {u.driverApp?.sentAt ? fmtDate(u.driverApp.sentAt) : ''}
                </div>
              </span>
            </span>
            <button className="btn primary sm" onClick={() => setOpen(u)}>
              Revisar
            </button>
          </div>
        ))}
      </div>

      {!!waitingCode.length && (
        <div className="card">
          <h3>🔑 Aprobados, esperando que ingresen su código</h3>
          {waitingCode.map((u) => (
            <CodeRow key={u.id} u={u} />
          ))}
        </div>
      )}

      <OnlineNow drivers={drivers} shipments={shipments} />
      <Ranking drivers={drivers} stats={stats} />

      <div className="card">
        <h3>🛵 Todos los repartidores ({drivers.length})</h3>
        {!drivers.length && <p className="muted sm">Aún no hay repartidores.</p>}
        {drivers.map((d) => {
          const st = stats[d.id] || { n: 0, r: [] };
          const susp = d.suspendedUntil && d.suspendedUntil > Date.now();
          const state = d.approved ? (d.online ? 'En línea' : 'Desconectado') : susp ? `Suspendido hasta ${new Date(d.suspendedUntil).toLocaleDateString('es')}` : d.suspendedUntil ? 'Suspensión vencida' : 'Bloqueado';
          return (
            <div key={d.id} className="driver-row driver-admin-row">
              <span className="row gap">
                <Avatar me={d} size={44} />
                <span>
                  <span className={`online-dot ${d.online && d.approved ? 'on' : ''}`} /> <b>{d.name}</b> {d.badge && <span className="tag">🏆 {d.badge}</span>}
                  <div className="muted sm">
                    {d.vehicle} {d.plate} · {st.n} entregas · ★ {st.r.length ? (st.r.reduce((a, b) => a + b, 0) / st.r.length).toFixed(1) : '—'}
                  </div>
                  {d.driverApp?.updatedAt && <span className="tag">✏️ Actualizó sus datos el {new Date(d.driverApp.updatedAt).toLocaleDateString('es')}</span>}
                  <div className={`sm ${d.approved ? '' : 'warn'}`}>{state}{!d.approved && d.blockReason ? ` · ${d.blockReason}` : ''}</div>
                </span>
              </span>
              <div className="row gap wrap">
                <button className="btn ghost sm" onClick={() => setOpen(d)}>
                  Ficha
                </button>
                {d.approved ? (
                  <>
                    <button className="btn ghost sm" onClick={() => suspend(d)}>
                      ⏸️ Suspender
                    </button>
                    <button className="btn ghost danger sm" onClick={() => block(d)}>
                      ⛔ Bloquear
                    </button>
                  </>
                ) : (
                  <button className="btn success sm" onClick={() => updateUser(d.id, { approved: true, suspendedUntil: null, blockReason: null })}>
                    ▶️ Reactivar
                  </button>
                )}
                <button className="btn ghost danger sm" onClick={() => removeDriver(d)}>
                  🗑️ Eliminar
                </button>
                <ContactBar name={d.name} phone={d.phone} shipment={{ code: '' }} compact />
              </div>
            </div>
          );
        })}
      </div>

      {open && <ApplicationModal u={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CodeRow({ u }) {
  const [code, setCode] = useState(null);
  return (
    <div className="row between wrap gap driver-row">
      <span>
        <b>{u.name}</b> <span className="muted sm">· {u.phone}</span>
      </span>
      {code ? (
        <span className="row gap">
          <b className="code-big">{code}</b>
          <a className="btn wa sm" href={codeLink(u.phone, u.name, code)} target="_blank" rel="noreferrer">
            <WhatsAppIcon /> Enviar
          </a>
        </span>
      ) : (
        <button className="btn ghost sm" onClick={async () => setCode((await getOne('driverCodes', u.id))?.code || '—')}>
          Ver código
        </button>
      )}
    </div>
  );
}

function ApplicationModal({ u, onClose }) {
  const [app, setApp] = useState(undefined);
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getOne('driverApps', u.id).then((a) => setApp(a || null));
  }, [u.id]);
  const p = app?.photos || {};
  const pending = u.driverStatus === 'pending';

  return (
    <Modal title={`Solicitud de ${u.driverApp?.fullName || u.name}`} onClose={onClose} wide>
      {app === undefined && <p className="muted">Cargando…</p>}
      {app === null && <p className="muted">No se encontró la solicitud (puede que aún no se haya sincronizado).</p>}
      {app && (
        <div className="driver-app">
          <div className="evidence">
            {[
              ['selfie', 'Repartidor'],
              ['ciFront', 'Carnet (adelante)'],
              ['ciBack', 'Carnet (atrás)'],
              ['vehicle', 'Vehículo'],
              ['license', 'Licencia'],
            ].map(([k, l]) =>
              p[k] ? (
                <figure key={k}>
                  <a href={p[k]} target="_blank" rel="noreferrer">
                    <img src={p[k]} alt={l} />
                  </a>
                  <figcaption>{l}</figcaption>
                </figure>
              ) : null
            )}
          </div>
          <dl className="details">
            <dt>Nombre</dt>
            <dd>{app.fullName}</dd>
            <dt>Carnet</dt>
            <dd>
              {app.ci} {app.ciExt}
            </dd>
            <dt>Nacimiento</dt>
            <dd>{app.birth || '—'}</dd>
            <dt>Celular</dt>
            <dd>{app.phone}</dd>
            <dt>Correo</dt>
            <dd>{app.email || '—'}</dd>
            <dt>Domicilio</dt>
            <dd>{app.homeAddress}</dd>
            <dt>Vehículo</dt>
            <dd>
              {app.vehicle} {app.brand} {app.color} · Placa <b>{app.plate || '—'}</b>
            </dd>
            <dt>Licencia</dt>
            <dd>{app.license || '—'}</dd>
            <dt>Enviada</dt>
            <dd>{fmtDate(app.createdAt)}</dd>
          </dl>
          <h4>Números de confianza</h4>
          {(app.contacts || []).map((c, i) => (
            <div key={i} className="row between wrap gap driver-row">
              <span>
                <b>{c.name}</b> <span className="muted sm">{c.relation}</span> · {c.phone}
              </span>
              <ContactBar name={c.name} phone={c.phone} shipment={{ code: '' }} compact />
            </div>
          ))}

          {code ? (
            <div className="card success center">
              <p>✅ Aprobado. Código de ingreso:</p>
              <div className="code-big">{code}</div>
              <a className="btn wa block lg" href={codeLink(app.phone || u.phone, app.fullName || u.name, code)} target="_blank" rel="noreferrer">
                <WhatsAppIcon /> Enviar código por WhatsApp
              </a>
              <p className="muted sm">También puedes dárselo en persona. El repartidor lo ingresa en Configuración → Trabajar como repartidor.</p>
            </div>
          ) : (
            pending && (
              <div className="row gap wrap" style={{ marginTop: 12 }}>
                <button
                  className="btn success lg grow"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setCode(await approveDriverApp(u.id, app));
                    setBusy(false);
                  }}
                >
                  ✔ Aprobar y generar código
                </button>
                <button
                  className="btn ghost danger"
                  onClick={async () => {
                    const r = prompt('Motivo del rechazo (se le mostrará al solicitante):', 'Faltan datos o fotos claras');
                    if (r === null) return;
                    await rejectDriverApp(u.id, r);
                    onClose();
                  }}
                >
                  Rechazar
                </button>
              </div>
            )
          )}
        </div>
      )}
    </Modal>
  );
}

function suspend(d) {
  const days = prompt(`¿Cuántos días suspender a ${d.name}?`, '3');
  if (!days) return;
  const reason = prompt('Motivo (se le mostrará):', 'Incumplimiento de normas') || '';
  updateUser(d.id, { approved: false, online: false, suspendedUntil: Date.now() + Number(days) * 864e5, blockReason: reason });
  notifyUser(d.id, null, `⏸️ Tu cuenta de repartidor fue suspendida por ${days} día(s). ${reason}`);
}
function block(d) {
  const reason = prompt(`Motivo del bloqueo de ${d.name}:`, '');
  if (reason === null) return;
  updateUser(d.id, { approved: false, online: false, suspendedUntil: null, blockReason: reason });
  notifyUser(d.id, null, `⛔ Tu cuenta de repartidor fue bloqueada. ${reason}`);
}
function removeDriver(d) {
  if (!confirm(`¿Eliminar a ${d.name} como repartidor? Su cuenta queda como cliente y se borran sus documentos. Sus entregas pasadas se conservan.`)) return;
  removeDriverAccount(d.id);
}

/** Repartidores en línea ahora y qué están haciendo */
export function OnlineNow({ drivers, shipments }) {
  const online = drivers.filter((d) => d.online && d.approved);
  return (
    <div className="card online-now">
      <h3>🟢 En línea ahora ({online.length})</h3>
      {!online.length && <p className="muted sm">Ningún repartidor conectado en este momento.</p>}
      <div className="online-grid">
        {online.map((d) => {
          const job = shipments.find((s) => s.driverId === d.id && ACTIVE.includes(s.status));
          return (
            <div key={d.id} className="online-item">
              <span className="avatar-ring">
                <Avatar me={d} size={48} />
              </span>
              <b className="sm">{d.name.split(' ')[0]}</b>
              <span className="muted sm">{job ? `${STATUS[job.status].label.split(' ').slice(0, 3).join(' ')} · ${job.code}` : 'Libre'}</span>
              {d.phone && (
                <a className="btn call sm" href={`tel:${d.phone}`}>
                  📞
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mejores repartidores (este mes) + felicitar */
function Ranking({ drivers, stats }) {
  const ranked = drivers
    .map((d) => {
      const st = stats[d.id] || { n: 0, r: [], month: 0 };
      const avg = st.r.length ? st.r.reduce((a, b) => a + b, 0) / st.r.length : 0;
      return { d, month: st.month || 0, avg };
    })
    .filter((x) => x.month > 0)
    .sort((a, b) => b.month - a.month || b.avg - a.avg)
    .slice(0, 5);
  const medals = ['🥇', '🥈', '🥉', '4°', '5°'];
  const congratulate = (d, place) => {
    const badge = place === 0 ? 'Repartidor del mes' : 'Top repartidor';
    updateUser(d.id, { badge, badgeAt: Date.now() });
    notifyUser(d.id, null, `🏆 ¡Felicidades! Eres ${badge} de Envia2 Express. ¡Gracias por tu gran trabajo!`);
    window.open(whatsappLink(d.phone, `🏆 ¡Felicidades ${d.name.split(' ')[0]}! Eres *${badge}* de Envia2 Express. ¡Gracias por tu esfuerzo y tu buen servicio! 🛵💙`), '_blank');
  };
  return (
    <div className="card ranking">
      <h3>🏆 Mejores repartidores del mes</h3>
      {!ranked.length && <p className="muted sm">Aún no hay entregas este mes.</p>}
      {ranked.map(({ d, month, avg }, i) => (
        <div key={d.id} className="row between wrap gap rank-row">
          <span className="row gap">
            <span className="medal">{medals[i]}</span>
            <Avatar me={d} size={36} />
            <span>
              <b>{d.name}</b>
              <div className="muted sm">
                {month} entregas · ★ {avg ? avg.toFixed(1) : '—'}
              </div>
            </span>
          </span>
          <button className="btn sm congrats" onClick={() => congratulate(d, i)}>
            🎉 Felicitar
          </button>
        </div>
      ))}
    </div>
  );
}
