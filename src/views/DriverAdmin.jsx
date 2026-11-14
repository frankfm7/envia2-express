import { useEffect, useMemo, useState } from 'react';
import { Modal, ContactBar, WhatsAppIcon } from '../components/Common';
import { useStore, getOne, approveDriverApp, rejectDriverApp, updateUser } from '../lib/store';
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
      const x = (m[s.driverId] ||= { n: 0, r: [] });
      x.n++;
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

      <div className="card">
        <h3>🛵 Repartidores activos ({drivers.filter((d) => d.approved).length})</h3>
        {!drivers.length && <p className="muted sm">Aún no hay repartidores.</p>}
        {drivers.map((d) => {
          const st = stats[d.id] || { n: 0, r: [] };
          return (
            <div key={d.id} className="row between wrap gap driver-row">
              <span className="row gap">
                <Avatar me={d} size={40} />
                <span>
                  <span className={`online-dot ${d.online ? 'on' : ''}`} /> <b>{d.name}</b> {!d.approved && <span className="tag">Bloqueado</span>}
                  <div className="muted sm">
                    {d.vehicle} {d.plate} · {st.n} entregas · ★ {st.r.length ? (st.r.reduce((a, b) => a + b, 0) / st.r.length).toFixed(1) : '—'}
                  </div>
                </span>
              </span>
              <div className="row gap">
                <button className="btn ghost sm" onClick={() => setOpen(d)}>
                  Ficha
                </button>
                {d.approved ? (
                  <button className="btn ghost danger sm" onClick={() => confirm(`¿Bloquear a ${d.name}?`) && updateUser(d.id, { approved: false, online: false })}>
                    Bloquear
                  </button>
                ) : (
                  <button className="btn sm" onClick={() => updateUser(d.id, { approved: true })}>
                    Desbloquear
                  </button>
                )}
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
