import { useMemo, useState } from 'react';
import MapView from '../components/MapView';
import Receipt from '../components/Receipt';
import { StatusBadge, Modal, Timeline, ContactBar } from '../components/Common';
import { useStore, STATUS, ACTIVE, exportBackup, importBackup, resetAll, updateUser, CLOUD } from '../lib/store';
import CatalogBoxes from './CatalogBoxes';
import Quote from './Quote';
import { fmtDate } from '../lib/geo';
import { money, SIZES } from '../lib/config';

export default function AdminApp({ me }) {
  const [tab, setTab] = useState('panel');
  return (
    <div className="page">
      <div className="tabs big">
        <button className={tab === 'panel' ? 'on' : ''} onClick={() => setTab('panel')}>
          📊 Panel
        </button>
        <button className={tab === 'catalog' ? 'on' : ''} onClick={() => setTab('catalog')}>
          💄 Cajas de catálogo
        </button>
        <button className={tab === 'quote' ? 'on' : ''} onClick={() => setTab('quote')}>
          💲 Tarifas
        </button>
      </div>
      {tab === 'panel' ? <Dashboard /> : tab === 'catalog' ? <CatalogBoxes me={me} /> : <Quote onBack={() => setTab('panel')} />}
    </div>
  );
}

function Dashboard() {
  const { shipments, users } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(null);

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return shipments.filter(
      (s) =>
        (status === 'all' || (status === 'active' ? ACTIVE.includes(s.status) : s.status === status)) &&
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

      <div className="split">
        <div className="split-map">
          <h3 className="section-title">Repartidores en ruta ahora</h3>
          <LiveMap ships={activeShip} />
        </div>
        <div className="split-form">
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
          <div className="card">
            <h3>Repartidores</h3>
            {!drivers.length && <div className="muted">Aún no hay repartidores registrados.</div>}
            {drivers.map((d) => {
              const n = delivered.filter((s) => s.driverId === d.id);
              const r = n.filter((s) => s.rating);
              return (
                <div key={d.id} className="row between driver-row">
                  <div>
                    <span className={`online-dot ${d.online ? 'on' : ''}`} /> <b>{d.name}</b>
                    <div className="muted sm">
                      {d.vehicle} {d.plate} · {n.length} entregas · ★ {r.length ? (r.reduce((a, s) => a + s.rating, 0) / r.length).toFixed(1) : '—'}
                    </div>
                  </div>
                  <div className="row gap">
                    {!d.approved && (
                      <button className="btn success sm" onClick={() => updateUser(d.id, { approved: true })}>
                        Aprobar
                      </button>
                    )}
                    {d.approved && CLOUD && (
                      <button className="btn ghost sm" onClick={() => confirm(`¿Bloquear a ${d.name}?`) && updateUser(d.id, { approved: false, online: false })}>
                        Bloquear
                      </button>
                    )}
                    <ContactBar name={d.name} phone={d.phone} shipment={{ code: '' }} compact />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <h3 className="section-title">Envíos</h3>
      <div className="row gap wrap filters">
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar guía, cliente, repartidor, dirección…" />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Todos</option>
          <option value="active">En ruta</option>
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

      {sel && (
        <Modal title={`Envío ${sel.code}`} onClose={() => setOpen(null)} wide>
          {sel.status === 'delivered' ? (
            <Receipt shipment={sel} />
          ) : (
            <div>
              <MapView pickup={sel.pickup} dropoff={sel.dropoff} driver={sel.driverPos} route={sel.route || sel.tripRoute} track={sel.track} height={300} />
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
