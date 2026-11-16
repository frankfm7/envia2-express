import { useEffect, useMemo, useState } from 'react';
import MapView from '../components/MapView';
import Receipt from '../components/Receipt';
import { StatusBadge, Modal, Timeline, ContactBar } from '../components/Common';
import { useStore, STATUS, ACTIVE, exportBackup, importBackup, resetAll, updateUser, CLOUD, useSettings, saveSettings, adminRulesOk, diagnoseSession } from '../lib/store';
import { compressImage } from '../lib/proof';
import CatalogBoxes from './CatalogBoxes';
import Quote from './Quote';
import DriverAdmin, { OnlineNow } from './DriverAdmin';
import Reports from './Reports';
import OffersAdmin from './OffersAdmin';
import HomeBanner from '../components/HomeBanner';
import { fmtDate } from '../lib/geo';
import { money, SIZES } from '../lib/config';

export default function AdminApp({ me, view }) {
  const [tab, setTab] = useState(view?.id === 'drivers' ? 'drivers' : 'panel');
  useEffect(() => {
    if (view?.id === 'drivers') setTab('drivers');
  }, [view?.id]);
  const { users } = useStore();
  const pendingApps = users.filter((u) => u.driverStatus === 'pending').length;
  const [rulesOk, setRulesOk] = useState(true);
  const [keyIssue, setKeyIssue] = useState(null);
  useEffect(() => {
    adminRulesOk().then(setRulesOk);
    diagnoseSession().then(setKeyIssue);
  }, []);
  if (view?.name === 'orders') return <div className="page"><Dashboard mode="orders" /></div>;
  if (view?.name === 'history') return <div className="page"><Dashboard mode="history" /></div>;
  return (
    <div className="page">
      {!rulesOk && (
        <div className="alert error">
          ⚠️ <b>Firebase no te reconoce como administrador.</b> Por eso no se guardan regalos, ajustes ni códigos de repartidor. En Firebase → Firestore → <b>Reglas</b>, cambia <code>tu_correo@gmail.com</code> por tu correo de administrador y toca <b>Publicar</b> (ver la guía).
        </div>
      )}
      {keyIssue && (
        <div className="alert error">
          ⚠️ <b>La sesión de todos se cerrará cada hora.</b> La clave de API de Google {keyIssue === 'referer' ? 'no tiene autorizado este sitio' : keyIssue === 'token-service' ? 'bloquea la "Token Service API" (renovar sesión)' : `tiene un problema (${keyIssue})`}. Corrígelo en Google Cloud → Credenciales → Browser key (guía: "Si la app pide iniciar sesión otra vez cada hora").
        </div>
      )}
      <div className="tabs big scroll-x">
        <button className={tab === 'panel' ? 'on' : ''} onClick={() => setTab('panel')}>
          📊 Panel
        </button>
        <button className={tab === 'drivers' ? 'on' : ''} onClick={() => setTab('drivers')}>
          🛵 Repartidores {pendingApps > 0 && <span className="count-inline">{pendingApps}</span>}
        </button>
        <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>
          📈 Informes
        </button>
        <button className={tab === 'offers' ? 'on' : ''} onClick={() => setTab('offers')}>
          🏷️ Ofertas
        </button>
        <button className={tab === 'catalog' ? 'on' : ''} onClick={() => setTab('catalog')}>
          💄 Catálogo
        </button>
        <button className={tab === 'quote' ? 'on' : ''} onClick={() => setTab('quote')}>
          💲 Tarifas
        </button>
      </div>
      {tab === 'panel' && (
        <>
          <HomeBanner role="admin" />
          <Dashboard mode="panel" />
        </>
      )}
      {tab === 'drivers' && <DriverAdmin />}
      {tab === 'reports' && <Reports />}
      {tab === 'offers' && <OffersAdmin />}
      {tab === 'catalog' && <CatalogBoxes me={me} />}
      {tab === 'quote' && <Quote onBack={() => setTab('panel')} />}
    </div>
  );
}

function Dashboard({ mode = 'panel' }) {
  const { shipments, users } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(mode === 'history' ? 'done' : mode === 'orders' ? 'open' : 'all');
  const [open, setOpen] = useState(null);

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return shipments.filter(
      (s) =>
        (status === 'all' ||
          (status === 'active' ? ACTIVE.includes(s.status) : status === 'open' ? !['delivered', 'cancelled'].includes(s.status) : status === 'done' ? ['delivered', 'cancelled'].includes(s.status) : s.status === status)) &&
        (!t || [s.code, s.clientName, s.driverName, s.recipient.name, s.dropoff?.address, s.recipient.phone, s.brand].join(' ').toLowerCase().includes(t))
    );
  }, [shipments, q, status]);

  const delivered = shipments.filter((s) => s.status === 'delivered');
  const todayStr = new Date().toDateString();
  const today = delivered.filter((s) => new Date(s.updatedAt).toDateString() === todayStr);
  const drivers = users.filter((u) => u.role === 'driver');
  const activeShip = shipments.filter((s) => ACTIVE.includes(s.status) && s.driverPos);
  const onTime = delivered.filter((s) => s.clientBiometric).length;

  const exportCsv = () => {
    const rows = [['Guía', 'Fecha', 'Estado', 'Cliente', 'Repartidor', 'Destinatario', 'Recibió', 'PIN', 'Destino', 'Importe', 'Pago', 'Distancia al destino (m)', 'Huella cliente', 'Sello']];
    shipments.forEach((s) =>
      rows.push([
        s.code,
        fmtDate(s.createdAt),
        STATUS[s.status].label,
        s.clientName,
        s.driverName || '',
        s.recipient.name,
        s.proof?.receivedBy || '',
        s.proof ? (s.proof.pinVerified ? 'Sí' : 'No') : '',
        s.dropoff?.address || '',
        s.finalPrice ?? s.price,
        s.payment,
        s.proof?.distanceToDropoff ?? '',
        s.clientBiometric ? 'Sí' : 'No',
        s.proof?.hash || '',
      ])
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = `boxruta-entregas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const sel = open && shipments.find((s) => s.id === open);

  return (
    <div>
      {mode === 'panel' && (
        <>
      <h2>Panel de control</h2>
      <div className="stats">
        <div className="stat">
          <span>Envíos totales</span>
          <b>{shipments.length}</b>
        </div>
        <div className="stat">
          <span>En curso</span>
          <b>{shipments.filter((s) => ACTIVE.includes(s.status) || s.status === 'pending').length}</b>
        </div>
        <div className="stat">
          <span>Entregados hoy</span>
          <b>{today.length}</b>
        </div>
        <div className="stat">
          <span>Ingresos hoy</span>
          <b>{money(today.reduce((a, s) => a + (s.finalPrice ?? s.price ?? 0), 0))}</b>
        </div>
        <div className="stat">
          <span>Repartidores en línea</span>
          <b>
            {drivers.filter((d) => d.online).length}/{drivers.length}
          </b>
        </div>
        <div className="stat">
          <span>Confirmados por cliente</span>
          <b>
            {onTime}/{delivered.length}
          </b>
        </div>
      </div>

      <OnlineNow drivers={drivers} shipments={shipments} />
      <div className="split">
        <div className="split-map">
          <h3 className="section-title">Repartidores en ruta ahora</h3>
          <LiveMap ships={activeShip} />
        </div>
        <div className="split-form">
          <QrCard />
          <div className="card">
            <h3>Respaldo de datos</h3>
            <p className="muted sm">Descarga todas las entregas con sus fotos, firmas y sellos. Guarda el archivo en tu computadora o en la nube.</p>
            <div className="row gap wrap">
              <button className="btn primary" onClick={exportBackup}>
                ⬇️ Respaldo completo (JSON)
              </button>
              <button className="btn" onClick={exportCsv}>
                📊 Excel (CSV)
              </button>
              <label className="btn ghost">
                ⬆️ Restaurar
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      importBackup(await f.text());
                      alert('Respaldo restaurado');
                    } catch (er) {
                      alert('Archivo no válido: ' + er.message);
                    }
                  }}
                />
              </label>
              <button className="btn ghost danger" onClick={() => confirm('¿Borrar TODOS los datos? Descarga un respaldo antes.') && resetAll()}>
                Borrar todo
              </button>
            </div>
          </div>
        </div>
      </div>

        </>
      )}
      {mode !== 'panel' && (
        <>
      <h2>{mode === 'orders' ? '📦 Pedidos' : '🕑 Historial'}</h2>
      <div className="row gap wrap filters">
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar guía, cliente, repartidor, dirección…" />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Todos</option>
          <option value="open">Abiertos (sin terminar)</option>
          <option value="active">En ruta</option>
          <option value="done">Terminados (entregados y cancelados)</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Guía</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Destino</th>
              <th>Repartidor</th>
              <th>Estado</th>
              <th>Evidencias</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} onClick={() => setOpen(s.id)}>
                <td>
                  <b>{s.code}</b>
                </td>
                <td>{fmtDate(s.createdAt)}</td>
                <td>{s.clientName}</td>
                <td className="ellipsis">{s.dropoff?.address || 'Por confirmar'}</td>
                <td>{s.driverName || '—'}</td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td className="nowrap">
                  {s.proof ? (
                    <>
                      {s.proof.signature && '✍️'} {s.proof.photo && '📸'} {s.proof.pinVerified && '🔐'} {s.clientBiometric && '👆'}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{s.brand ? <span className="tag brand">{s.brand}</span> : money(s.finalPrice ?? s.price)}</td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan="8" className="empty">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

      {sel && (
        <Modal title={`Envío ${sel.code}`} onClose={() => setOpen(null)} wide>
          {sel.status === 'delivered' ? (
            <Receipt shipment={sel} />
          ) : (
            <div>
              <MapView pickup={sel.pickup} dropoff={sel.dropoff} driver={sel.driverPos} route={sel.route || sel.tripRoute} track={sel.track} height={300} tracking />
              <p>
                <StatusBadge status={sel.status} /> {SIZES[sel.size]?.label} × {sel.qty} · {money(sel.price)}
              </p>
              {sel.incident && <div className="alert warn">Incidencia: {sel.incident.reason}</div>}
              <Timeline shipment={sel} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function LiveMap({ ships }) {
  const first = ships[0];
  if (!ships.length) return <div className="card empty">No hay repartidores en ruta en este momento.</div>;
  return (
    <div>
      <MapView pickup={ships.length === 1 ? first.pickup : null} dropoff={ships.length === 1 ? first.dropoff : null} drivers={ships.map((s) => s.driverPos)} route={ships.length === 1 ? first.route : null} height={320} />
      <div className="list sm">
        {ships.map((s) => (
          <div key={s.id} className="row between">
            <span>
              🛵 {s.driverName} → {s.recipient.name}
            </span>
            <StatusBadge status={s.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** QR de cobro del negocio (lo ven los clientes al pagar el adelanto de un mandado) */
function QrCard() {
  const st = useSettings();
  const [name, setName] = useState(st.qrName || '');
  return (
    <div className="card">
      <h3>💳 QR de cobro y soporte</h3>
      <p className="muted sm">Los clientes lo ven al pagar el adelanto de los mandados (mínimo 50 % de la compra).</p>
      {st.qrImage && (
        <div className="qr-box">
          <img src={st.qrImage} alt="QR de cobro" />
        </div>
      )}
      <div className="row gap wrap">
        <label className="btn">
          {st.qrImage ? 'Cambiar QR' : 'Subir QR (foto o captura)'}
          <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files?.[0] && saveSettings({ qrImage: await compressImage(e.target.files[0], 700, 0.9, false) })} />
        </label>
        {st.qrImage && (
          <button className="btn ghost danger sm" onClick={() => saveSettings({ qrImage: null })}>
            Quitar
          </button>
        )}
      </div>
      <SupportPhone st={st} />
      <div className="field" style={{ marginTop: 8 }}>
        <label>Titular / banco (se muestra bajo el QR)</label>
        <div className="row gap">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Envia2 Express · Banco Unión" />
          <button className="btn sm" onClick={() => saveSettings({ qrName: name })}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function SupportPhone({ st }) {
  const [v, setV] = useState(st.supportPhone || '');
  return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>WhatsApp de asistencia (lo ven todos en Configuración)</label>
      <div className="row gap">
        <input value={v} onChange={(e) => setV(e.target.value)} inputMode="tel" placeholder="7 123 4567" />
        <button className="btn sm" onClick={() => saveSettings({ supportPhone: v.replace(/[^\d+]/g, '') })}>
          Guardar
        </button>
      </div>
    </div>
  );
}
