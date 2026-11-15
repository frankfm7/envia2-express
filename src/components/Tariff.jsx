import { useState } from 'react';
import { TIERS, LONG, RULES, SERVICES, CONDITIONS, EARNINGS, tariffMessage, conditionsMessage, driverEarning } from '../lib/tariff';
import { BUSINESS_NAME, money, whatsappLink } from '../lib/config';
import { fmtKm, fmtMin, googleMapsRouteLink, distance } from '../lib/geo';
import { WhatsAppIcon } from './Common';

const bs = (n) => money(n);

/** Ganancia estimada del repartidor para un tramo (solo repartidor / admin) */
const netRange = (price, kmFrom, kmTo) => {
  const a = driverEarning(price, kmTo).net;
  const b = driverEarning(price, kmFrom).net;
  return a === b ? bs(a) : `${bs(a)} – ${bs(b)}`;
};

/** Tabla de tarifas. `showNet` muestra la ganancia (solo repartidores/admin). */
export function TariffTable({ showNet = false }) {
  let prev = 0;
  return (
    <div className="table-wrap tariff">
      <table className="table">
        <thead>
          <tr>
            <th>Distancia (ruta)</th>
            <th>📦 Envío simple</th>
            <th>🛍️ Mandado / encargo</th>
            {showNet && <th>Ganancia (simple)</th>}
          </tr>
        </thead>
        <tbody>
          {TIERS.map((t) => {
            const from = prev;
            prev = t.upTo;
            return (
              <tr key={t.name}>
                <td>
                  <b>{t.name}</b>
                  {t.zone && <div className="muted sm">{t.zone}</div>}
                </td>
                <td>{bs(t.simple)}</td>
                <td>{bs(t.errand)}</td>
                {showNet && <td>{netRange(t.simple, from || 0.5, t.upTo)}</td>}
              </tr>
            );
          })}
          <tr>
            <td>
              <b>{LONG.name}</b>
              <div className="muted sm">{LONG.zone}</div>
            </td>
            <td>
              {bs(LONG.base.simple)} + {bs(LONG.perKm.simple)}/km extra
            </td>
            <td>
              {bs(LONG.base.errand)} + {bs(LONG.perKm.errand)}/km extra
            </td>
            {showNet && <td>Variable</td>}
          </tr>
        </tbody>
      </table>
      {showNet && (
        <p className="muted sm" style={{ padding: '6px 10px' }}>
          Ganancia = precio − gasolina/desgaste ({bs(EARNINGS.costPerKm)} por km){EARNINGS.commissionPct ? ` − comisión ${EARNINGS.commissionPct} %` : ''}. Se ajusta en <code>src/lib/tariff.js</code>.
        </p>
      )}
    </div>
  );
}

/** Las condiciones del servicio */
export function TariffRules({ forDriver }) {
  return (
    <div className="conditions">
      <b>⚡ Condiciones del servicio</b>
      <ol>
        {CONDITIONS.map(([t, d]) => (
          <li key={t}>
            <b>{t}:</b> {d}
          </li>
        ))}
      </ol>
      {forDriver && <p className="muted sm">📍 Si el cliente no usa la app: pídele las 2 ubicaciones por WhatsApp y pégalas en el cotizador.</p>}
    </div>
  );
}

/** Desglose de un precio calculado */
export function PriceBreakdown({ result, showNet }) {
  if (!result) return null;
  return (
    <div className="breakdown">
      {result.lines.map((l, i) => (
        <div key={i} className="row between">
          <span>{l.label}</span>
          <b>{bs(l.amount)}</b>
        </div>
      ))}
      <div className="row between total">
        <span>Total</span>
        <b>{bs(result.total)}</b>
      </div>
      {showNet && (
        <div className="earning">
          💰 Tu ganancia estimada: <b>{bs(driverEarning(result.total, result.km).net)}</b>
          <span className="muted sm"> (gasolina/desgaste ≈ {bs(driverEarning(result.total, result.km).cost)})</span>
        </div>
      )}
    </div>
  );
}

/**
 * Distancia por RUTA + opción de comparar en Google Maps y corregir a mano.
 * `km` es el valor que se usa para cobrar.
 */
export function RouteDistance({ a, b, route, manualKm, setManualKm, allowManual = true }) {
  const routeKm = route ? Math.round(route.distance / 100) / 10 : null;
  const [edit, setEdit] = useState(false);
  if (!a || !b) return <div className="muted sm">Marca el punto A y el punto B para medir la ruta.</div>;
  return (
    <div className="route-km">
      <div className="row between wrap gap">
        <div>
          <span className="muted sm">Distancia por la ruta</span>
          <div className="big-km">{manualKm ? `${String(manualKm).replace('.', ',')} km` : route ? fmtKm(route.distance) : 'Calculando…'}</div>
          {route && !manualKm && <span className="muted sm">≈ {fmtMin(route.duration)} de viaje</span>}
          {route && !route.approx && (
            <div className="sm straight">
              En línea recta serían {fmtKm(distance(a, b))}; por las calles son {fmtKm(route.distance)}
              {route.distance > distance(a, b) * 1.05 && ` (+${Math.round((route.distance / distance(a, b) - 1) * 100)} %)`}. Se cobra por la ruta.
            </div>
          )}
          {manualKm && <span className="tag">Medido a mano (Google Maps)</span>}
        </div>
        <a className="btn sm" href={googleMapsRouteLink(a, b)} target="_blank" rel="noreferrer">
          🗺️ Ver ruta en Google Maps
        </a>
      </div>
      {route?.approx && !manualKm && (
        <div className="alert warn sm">
          ⚠️ No se pudo calcular la ruta por calles (sin conexión al servicio de rutas). Se estimó con la línea recta + 45 %
          {allowManual ? ': mide en Google Maps y escríbelo abajo.' : '; el precio final lo confirma el repartidor midiendo la ruta.'}
        </div>
      )}
      {allowManual &&
        (edit || manualKm || route?.approx ? (
          <div className="row gap" style={{ marginTop: 8 }}>
            <input type="number" min="0" step="0.1" inputMode="decimal" placeholder={routeKm ? `${routeKm}` : 'km'} value={manualKm || ''} onChange={(e) => setManualKm(e.target.value ? Number(e.target.value) : null)} aria-label="Kilómetros medidos" />
            <span className="muted sm">km según Google Maps</span>
            {manualKm && (
              <button type="button" className="btn ghost sm" onClick={() => setManualKm(null)}>
                Usar ruta de la app
              </button>
            )}
          </div>
        ) : (
          <button type="button" className="btn ghost sm" onClick={() => setEdit(true)}>
            ✏️ Corregir km (si Google Maps marca otra distancia)
          </button>
        ))}
    </div>
  );
}

/** Tarjeta plegable con el tarifario + mensajes listos para WhatsApp Business */
export function TariffCard({ forDriver = false, open: startOpen = false }) {
  const [copied, setCopied] = useState('');
  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      window.open(whatsappLink('', text), '_blank');
    }
  };
  return (
    <details className="card tariff-card" open={startOpen}>
      <summary>
        <b>💲 Tarifario {forDriver ? '(sugerencia para repartidores)' : ''}</b>
      </summary>
      <TariffTable showNet={forDriver} />
      <TariffRules forDriver={forDriver} />
      {forDriver && (
        <div className="row gap wrap">
          <button className="btn sm" onClick={() => copy('t', tariffMessage(BUSINESS_NAME))}>
            {copied === 't' ? '✔ Copiado' : '📋 Copiar tarifario para WhatsApp'}
          </button>
          <button className="btn sm" onClick={() => copy('c', conditionsMessage(BUSINESS_NAME))}>
            {copied === 'c' ? '✔ Copiado' : '📋 Copiar condiciones del servicio'}
          </button>
          <a className="btn wa sm" href={whatsappLink('', tariffMessage(BUSINESS_NAME))} target="_blank" rel="noreferrer">
            <WhatsAppIcon /> Compartir tarifario
          </a>
        </div>
      )}
    </details>
  );
}

export { SERVICES };
