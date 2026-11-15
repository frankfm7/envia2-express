import { useMemo, useState } from 'react';
import { useStore, STATUS, ACTIVE } from '../lib/store';
import { driverEarning, SERVICES } from '../lib/tariff';
import { money, whatsappLink, BUSINESS_NAME } from '../lib/config';
import { fmtDate } from '../lib/geo';
import { WhatsAppIcon } from '../components/Common';

const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deliveredAt = (s) => s.events?.find((e) => e.status === 'delivered')?.ts || s.updatedAt;
const pctChange = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);

/** Rango [desde, hasta) y el período anterior para comparar */
function rangeFor(kind, value) {
  const now = new Date();
  let from;
  let to;
  let label;
  if (kind === 'day') {
    const d = value ? new Date(value + 'T00:00') : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    from = d.getTime();
    to = from + DAY;
    label = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } else if (kind === 'month') {
    const [y, m] = (value || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`).split('-').map(Number);
    from = new Date(y, m - 1, 1).getTime();
    to = new Date(y, m, 1).getTime();
    label = new Date(from).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  } else if (kind === 'quarter') {
    const [y, q] = (value || `${now.getFullYear()}-${Math.floor(now.getMonth() / 3) + 1}`).split('-').map(Number);
    from = new Date(y, (q - 1) * 3, 1).getTime();
    to = new Date(y, q * 3, 1).getTime();
    label = `Trimestre ${q} de ${y}`;
  } else {
    const y = Number(value) || now.getFullYear();
    from = new Date(y, 0, 1).getTime();
    to = new Date(y + 1, 0, 1).getTime();
    label = `Año ${y}`;
  }
  return { from, to, prevFrom: from - (to - from), prevTo: from, label };
}

/** Cálculo de un informe para [from, to) */
export function buildReport(shipments, users, from, to) {
  const created = shipments.filter((s) => s.createdAt >= from && s.createdAt < to);
  const delivered = shipments.filter((s) => s.status === 'delivered' && deliveredAt(s) >= from && deliveredAt(s) < to);
  const cancelled = created.filter((s) => s.status === 'cancelled');
  const stored = created.filter((s) => s.status === 'stored');
  const income = delivered.reduce((a, s) => a + (s.finalPrice ?? s.price ?? 0), 0);
  const discounts = delivered.reduce((a, s) => a + (s.coupon?.discount || 0), 0);
  const cash = delivered.reduce((a, s) => a + (s.proof?.cashCollected || 0), 0);
  const purchases = delivered.reduce((a, s) => a + (s.proof?.charge?.purchase || 0), 0);
  const km = delivered.reduce((a, s) => a + (s.routeKm || 0), 0);
  const earnings = delivered.reduce((a, s) => a + driverEarning((s.finalPrice ?? s.price ?? 0) + (s.coupon?.discount || 0), s.routeKm || 0).net, 0);
  const times = delivered.map((s) => (deliveredAt(s) - s.createdAt) / 60000).filter((m) => m > 0 && m < 24 * 60);
  const rated = delivered.filter((s) => s.rating);
  const byDriver = {};
  delivered.forEach((s) => {
    const k = s.driverId || '—';
    const x = (byDriver[k] ||= { id: k, name: s.driverName || '—', n: 0, income: 0, earn: 0, r: [] });
    x.n++;
    x.income += s.finalPrice ?? s.price ?? 0;
    x.earn += driverEarning((s.finalPrice ?? s.price ?? 0) + (s.coupon?.discount || 0), s.routeKm || 0).net;
    if (s.rating) x.r.push(s.rating);
  });
  const byService = Object.keys(SERVICES).map((k) => ({ k, label: SERVICES[k].label, n: delivered.filter((s) => (s.service || 'simple') === k).length }));
  const byDay = {};
  delivered.forEach((s) => {
    const d = isoDay(new Date(deliveredAt(s)));
    byDay[d] = (byDay[d] || 0) + (s.finalPrice ?? s.price ?? 0);
  });
  const newClients = users.filter((u) => u.role === 'client' && u.createdAt >= from && u.createdAt < to).length;
  return {
    created: created.length,
    delivered: delivered.length,
    cancelled: cancelled.length,
    stored: stored.length,
    income,
    discounts,
    cash,
    purchases,
    km: Math.round(km * 10) / 10,
    earnings: Math.round(earnings * 10) / 10,
    avgTicket: delivered.length ? income / delivered.length : 0,
    avgMin: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    rating: rated.length ? (rated.reduce((a, s) => a + s.rating, 0) / rated.length).toFixed(1) : '—',
    drivers: Object.values(byDriver).sort((a, b) => b.n - a.n),
    byService,
    byDay: Object.entries(byDay).sort(),
    newClients,
    list: delivered,
  };
}

function Kpi({ label, value, prev, money: isMoney }) {
  const ch = prev != null ? pctChange(value, prev) : null;
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{isMoney ? money(value) : value}</b>
      {ch != null && <small className={ch >= 0 ? 'up' : 'down'}>{ch >= 0 ? '▲' : '▼'} {Math.abs(ch)} % vs. período anterior</small>}
    </div>
  );
}

function ReportView({ title, r, p }) {
  const max = Math.max(1, ...r.byDay.map(([, v]) => v));
  return (
    <div className="report" id="report-print">
      <div className="report-head">
        <div>
          <div className="muted sm">{BUSINESS_NAME} · Informe</div>
          <h2>{title}</h2>
          <div className="muted sm">Generado el {fmtDate(Date.now())}</div>
        </div>
      </div>
      <div className="stats">
        <Kpi label="Ingresos (envíos)" value={r.income} prev={p?.income} money />
        <Kpi label="Entregados" value={r.delivered} prev={p?.delivered} />
        <Kpi label="Pedidos creados" value={r.created} prev={p?.created} />
        <Kpi label="Cancelados" value={r.cancelled} prev={p?.cancelled} />
        <Kpi label="Ganancia repartidores" value={r.earnings} prev={p?.earnings} money />
        <Kpi label="Descuentos (cupones/ofertas)" value={r.discounts} money />
        <Kpi label="Efectivo cobrado" value={r.cash} money />
        <Kpi label="Ticket promedio" value={Math.round(r.avgTicket * 10) / 10} money />
        <div className="stat">
          <span>Tiempo promedio</span>
          <b>{r.avgMin != null ? `${r.avgMin} min` : '—'}</b>
        </div>
        <div className="stat">
          <span>Km recorridos</span>
          <b>{r.km}</b>
        </div>
        <div className="stat">
          <span>Calificación</span>
          <b>★ {r.rating}</b>
        </div>
        <div className="stat">
          <span>Clientes nuevos</span>
          <b>{r.newClients}</b>
        </div>
      </div>

      {r.byDay.length > 1 && (
        <div className="card">
          <h3>Ingresos por día</h3>
          <div className="bars">
            {r.byDay.map(([d, v]) => (
              <div key={d} className="bar-row">
                <span className="sm">{new Date(d + 'T12:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>
                <div className="bar">
                  <i style={{ width: `${(v / max) * 100}%` }} />
                </div>
                <b className="sm">{money(v)}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Por repartidor</h3>
        {!r.drivers.length && <p className="muted sm">Sin entregas en este período.</p>}
        {!!r.drivers.length && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Repartidor</th>
                  <th>Entregas</th>
                  <th>Ingresos</th>
                  <th>Ganancia</th>
                  <th>★</th>
                </tr>
              </thead>
              <tbody>
                {r.drivers.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{d.n}</td>
                    <td>{money(d.income)}</td>
                    <td>{money(Math.round(d.earn * 10) / 10)}</td>
                    <td>{d.r.length ? (d.r.reduce((a, b) => a + b, 0) / d.r.length).toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Por servicio</h3>
        {r.byService.map((x) => (
          <div key={x.k} className="row between sm spin-row">
            <span>{x.label}</span>
            <b>{x.n}</b>
          </div>
        ))}
        <div className="row between sm spin-row">
          <span>Compras de mandados (no es ingreso)</span>
          <b>{money(r.purchases)}</b>
        </div>
        <div className="row between sm spin-row">
          <span>En oficina (no entregados)</span>
          <b>{r.stored}</b>
        </div>
      </div>
    </div>
  );
}

const summaryText = (title, r) =>
  `📈 *${BUSINESS_NAME} — ${title}*\n` +
  `✅ Entregados: ${r.delivered}\n📦 Pedidos: ${r.created} · ❌ Cancelados: ${r.cancelled}\n` +
  `💰 Ingresos: ${money(r.income)}\n🛵 Ganancia repartidores: ${money(r.earnings)}\n🎫 Descuentos: ${money(r.discounts)}\n` +
  `★ Calificación: ${r.rating}\n` +
  (r.drivers.length ? `\n🏆 ${r.drivers.map((d) => `${d.name}: ${d.n} entregas`).join('\n')}` : '');

function exportCsv(title, r) {
  const rows = [['Guía', 'Entregado', 'Cliente', 'Repartidor', 'Servicio', 'Km', 'Precio', 'Descuento', 'Cobrado', 'Calificación']];
  r.list.forEach((s) =>
    rows.push([s.code, fmtDate(deliveredAt(s)), s.clientName, s.driverName || '', SERVICES[s.service || 'simple'].label, s.routeKm ?? '', s.finalPrice ?? s.price ?? 0, s.coupon?.discount || 0, s.proof?.cashCollected ?? '', s.rating || ''])
  );
  const csv = rows.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = `informe-${title.replace(/\s+/g, '-').toLowerCase()}.csv`;
  a.click();
}

/** Informe general: hoy, ayer y lo que viene (programados / en curso) */
function GeneralReport({ shipments, users }) {
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const today = buildReport(shipments, users, t0.getTime(), t0.getTime() + DAY);
  const yest = buildReport(shipments, users, t0.getTime() - DAY, t0.getTime());
  const upcoming = shipments
    .filter((s) => !['delivered', 'cancelled'].includes(s.status))
    .map((s) => ({ s, when: s.scheduledAt || (s.meeting ? new Date(s.meeting.date + 'T' + s.meeting.window.slice(0, 5)).getTime() : s.createdAt) }))
    .sort((a, b) => a.when - b.when);
  const onRoute = shipments.filter((s) => ACTIVE.includes(s.status));
  const online = users.filter((u) => u.role === 'driver' && u.online && u.approved);
  return (
    <div className="report" id="report-print">
      <h2>Informe general</h2>
      <div className="muted sm">Generado el {fmtDate(Date.now())}</div>
      <div className="grid2">
        <div className="card">
          <h3>Hoy</h3>
          <p className="sm">
            ✅ {today.delivered} entregados · 📦 {today.created} pedidos · ❌ {today.cancelled} cancelados
            <br />💰 {money(today.income)} · 🛵 ganancia {money(today.earnings)}
          </p>
        </div>
        <div className="card">
          <h3>Ayer</h3>
          <p className="sm">
            ✅ {yest.delivered} entregados · 📦 {yest.created} pedidos · ❌ {yest.cancelled} cancelados
            <br />💰 {money(yest.income)} · 🛵 ganancia {money(yest.earnings)}
          </p>
        </div>
      </div>
      <div className="card">
        <h3>
          Ahora: {onRoute.length} en ruta · {online.length} repartidor(es) en línea
        </h3>
        {online.map((u) => (
          <span key={u.id} className="tag" style={{ marginRight: 6 }}>
            🟢 {u.name}
          </span>
        ))}
      </div>
      <div className="card">
        <h3>Pendientes y próximos ({upcoming.length})</h3>
        {!upcoming.length && <p className="muted sm">No hay pedidos pendientes.</p>}
        {upcoming.slice(0, 40).map(({ s, when }) => (
          <div key={s.id} className="row between sm spin-row">
            <span>
              <b>{s.code}</b> · {s.recipient?.name} · {STATUS[s.status]?.label}
            </span>
            <span className="muted">{fmtDate(when)}</span>
          </div>
        ))}
      </div>
      <div className="row gap wrap no-print">
        <a className="btn wa" target="_blank" rel="noreferrer" href={whatsappLink('', summaryText('Hoy', today) + `\n\n📅 Pendientes: ${upcoming.length}`)}>
          <WhatsAppIcon /> Compartir resumen
        </a>
        <button className="btn" onClick={() => window.print()}>
          🖨️ Imprimir / PDF
        </button>
      </div>
    </div>
  );
}

export default function Reports() {
  const { shipments, users } = useStore();
  const [kind, setKind] = useState('general');
  const now = new Date();
  const [day, setDay] = useState(isoDay(now));
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [quarter, setQuarter] = useState(`${now.getFullYear()}-${Math.floor(now.getMonth() / 3) + 1}`);
  const [year, setYear] = useState(String(now.getFullYear()));
  const value = { day, month, quarter, year }[kind];
  const rg = kind === 'general' ? null : rangeFor(kind, value);
  const r = useMemo(() => (rg ? buildReport(shipments, users, rg.from, rg.to) : null), [shipments, users, rg?.from, rg?.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = useMemo(() => (rg ? buildReport(shipments, users, rg.prevFrom, rg.prevTo) : null), [shipments, users, rg?.prevFrom]); // eslint-disable-line react-hooks/exhaustive-deps
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <div className="seg scroll-x no-print">
        {[
          ['general', 'General'],
          ['day', 'Diario'],
          ['month', 'Mensual'],
          ['quarter', 'Trimestral'],
          ['year', 'Anual'],
        ].map(([k, l]) => (
          <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="row gap wrap no-print report-pick">
        {kind === 'day' && (
          <>
            <input type="date" value={day} max={isoDay(now)} onChange={(e) => setDay(e.target.value)} aria-label="Día" />
            <button className="btn ghost sm" onClick={() => setDay(isoDay(new Date(Date.now() - DAY)))}>
              Ayer
            </button>
            <button className="btn ghost sm" onClick={() => setDay(isoDay(now))}>
              Hoy
            </button>
          </>
        )}
        {kind === 'month' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes" />}
        {kind === 'quarter' && (
          <select value={quarter} onChange={(e) => setQuarter(e.target.value)} aria-label="Trimestre">
            {years.flatMap((y) => [4, 3, 2, 1].map((q) => <option key={`${y}-${q}`} value={`${y}-${q}`}>{`T${q} ${y}`}</option>))}
          </select>
        )}
        {kind === 'year' && (
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Año">
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        )}
      </div>
      {kind === 'general' ? (
        <GeneralReport shipments={shipments} users={users} />
      ) : (
        <>
          <ReportView title={rg.label.charAt(0).toUpperCase() + rg.label.slice(1)} r={r} p={p} />
          <div className="row gap wrap no-print">
            <button className="btn primary" onClick={() => window.print()}>
              🖨️ Imprimir / Guardar PDF
            </button>
            <button className="btn" onClick={() => exportCsv(rg.label, r)}>
              📊 Excel (CSV)
            </button>
            <a className="btn wa" target="_blank" rel="noreferrer" href={whatsappLink('', summaryText(rg.label, r))}>
              <WhatsAppIcon /> Enviar resumen
            </a>
          </div>
        </>
      )}
    </div>
  );
}
