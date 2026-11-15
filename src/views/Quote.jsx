import { useEffect, useState } from 'react';
import MapView from '../components/MapView';
import { AddressInput, WhatsAppIcon } from '../components/Common';
import { RouteDistance, PriceBreakdown, TariffCard } from '../components/Tariff';
import { getRoute, fmtMin, getCurrentPosition, reverseGeocode } from '../lib/geo';
import { computeTariff, isNight, RULES, SERVICES, STRAIGHT_TO_ROUTE, estimateFromStraight } from '../lib/tariff';
import { BUSINESS_NAME, money, whatsappLink } from '../lib/config';

/**
 * Cotizador rápido (repartidor / administrador).
 * El cliente manda sus 2 ubicaciones por WhatsApp → se pegan aquí → la app mide
 * la RUTA por calles y calcula el precio del tarifario → se responde por WhatsApp.
 */
/**
 * role = 'client': el cliente calcula cuánto le cuesta → "Precio sugerido" → Aceptar y solicitar.
 * role = 'staff' : repartidor / admin (ganancia neta, corregir km, enviar cotización por WhatsApp).
 */
export default function Quote({ onBack, onCreate, onAccept, role = 'staff' }) {
  const client = role === 'client';
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [route, setRoute] = useState(null);
  const [manualKm, setManualKm] = useState(null);
  const [service, setService] = useState('simple');
  const [weather, setWeather] = useState(false);
  const [night, setNight] = useState(isNight());
  const [phone, setPhone] = useState('');
  // Cliente: 'map' = marcar A y B (la app mide la ruta) · 'straight' = escribir los km que midió en línea recta
  const [mode, setMode] = useState('map');
  const [straightKm, setStraightKm] = useState('');
  const est = client && mode === 'straight' && Number(straightKm) > 0 ? estimateFromStraight(straightKm, { service, night }) : null;
  const pct = (f) => Math.round((f - 1) * 100);

  // El cliente parte normalmente desde donde está
  useEffect(() => {
    if (!client) return;
    getCurrentPosition().then(async (p) => {
      if (!p) return;
      const address = await reverseGeocode(p);
      setA((cur) => cur || { lat: p.lat, lng: p.lng, address });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!a || !b) return setRoute(null);
    let alive = true;
    setRoute(null);
    getRoute(a, b).then((r) => alive && setRoute(r));
    return () => {
      alive = false;
    };
  }, [a?.lat, a?.lng, b?.lat, b?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const km = manualKm || (route ? route.distance / 1000 : null);
  const t = km != null ? computeTariff({ km, service, night, weather }) : null;

  const message = t
    ? `🛵 *${BUSINESS_NAME} — Cotización*\n` +
      `${SERVICES[service].icon} ${SERVICES[service].label}\n` +
      `📍 Recojo: ${a.address}\n🏁 Entrega: ${b.address}\n` +
      `📏 Distancia por ruta: ${String(t.km).replace('.', ',')} km${route && !manualKm ? ` (≈ ${fmtMin(route.duration)})` : ''}\n\n` +
      t.lines.map((l) => `• ${l.label}: ${money(l.amount)}`).join('\n') +
      `\n\n💰 *Total: ${money(t.total)}*` +
      (service === 'errand' ? ` + monto de la compra.\n🛍️ Adelantas por QR mínimo el 50 % de la compra (y nunca menos que el envío); el saldo, al recibir.` : '') +
      `\n⏱️ ${RULES.freeWaitMin} min de espera gratis por parada; luego Bs ${RULES.waitBlockPrice} cada 10 min.\n¿Confirmamos? ✅`
    : '';

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn ghost" onClick={onBack}>
          ← Volver
        </button>
        <h2>💲 {client ? '¿Cuánto me cuesta?' : 'Cotizar envío'}</h2>
      </div>
      <p className="muted sm">
        {client
          ? 'Marca desde dónde y hasta dónde quieres enviar. Calculamos el precio por la ruta que hará el repartidor (por las calles), no en línea recta.'
          : 'Pega las ubicaciones que te envió el cliente por WhatsApp (o búscalas). El precio se calcula por la ruta real, no en línea recta.'}
      </p>
      {client && (
        <div className="seg">
          <button className={mode === 'map' ? 'on' : ''} onClick={() => setMode('map')}>
            📍 Marcar en el mapa
          </button>
          <button className={mode === 'straight' ? 'on' : ''} onClick={() => setMode('straight')}>
            📏 Ya medí la distancia
          </button>
        </div>
      )}
      <div className="split">
        <div className="split-map" hidden={client && mode === 'straight'}>
          <MapView
            pickup={a}
            dropoff={b}
            route={route}
            height={320}
            onClick={async (p) => {
              const point = { ...p, address: await reverseGeocode(p) };
              if (!a) setA(point);
              else setB(point);
            }}
          />
          <p className="muted sm">Toca el mapa para marcar {a ? 'el destino (B)' : 'el origen (A)'}.</p>
          <div className="card" style={{ marginTop: 10 }}>
            <RouteDistance a={a} b={b} route={route} manualKm={manualKm} setManualKm={setManualKm} allowManual={!client} />
          </div>
        </div>
        <div className="split-form">
          {est !== undefined && client && mode === 'straight' && (
            <div className="card">
              <div className="service-grid">
                {Object.entries(SERVICES).map(([k, v]) => (
                  <button type="button" key={k} className={`service ${service === k ? 'sel' : ''}`} onClick={() => setService(k)}>
                    <span>{v.icon}</span>
                    <b>{v.label}</b>
                  </button>
                ))}
              </div>
              <div className="field">
                <label>Distancia en línea recta de A a B (km)</label>
                <input type="number" min="0" step="0.1" inputMode="decimal" value={straightKm} onChange={(e) => setStraightKm(e.target.value)} placeholder="Ej. 3" aria-label="Kilómetros en línea recta" />
              </div>
              <details className="howto">
                <summary>¿Cómo la mido en Google Maps?</summary>
                <ol className="sm">
                  <li>Mantén presionado el punto de partida hasta que aparezca un pin rojo.</li>
                  <li>Toca el nombre del lugar abajo → <b>Medir distancia</b>.</li>
                  <li>Mueve el mapa hasta el destino: abajo verás los km en línea recta.</li>
                </ol>
              </details>
              {est && (
                <div className="straight-calc">
                  <div className="row between">
                    <span>📏 Línea recta</span>
                    <b>{String(est.straightKm).replace('.', ',')} km</b>
                  </div>
                  <div className="row between">
                    <span>
                      🛣️ Por las calles (+{pct(STRAIGHT_TO_ROUTE.min)} a {pct(STRAIGHT_TO_ROUTE.max)} %)
                    </span>
                    <b>
                      {est.route.min.toFixed(1).replace('.', ',')} – {est.route.max.toFixed(1).replace('.', ',')} km
                    </b>
                  </div>
                  <p className="muted sm">Las calles nunca van en línea recta: por eso sumamos entre {pct(STRAIGHT_TO_ROUTE.min)} y {pct(STRAIGHT_TO_ROUTE.max)} % a tu medida.</p>
                </div>
              )}
            </div>
          )}
          <div className="card" hidden={client && mode === 'straight'}>
            <div className="service-grid">
              {Object.entries(SERVICES).map(([k, v]) => (
                <button type="button" key={k} className={`service ${service === k ? 'sel' : ''}`} onClick={() => setService(k)}>
                  <span>{v.icon}</span>
                  <b>{v.label}</b>
                </button>
              ))}
            </div>
            <AddressInput label={service === 'errand' ? 'A · Dónde comprar' : 'A · Recojo'} value={a} onChange={setA} placeholder="Pega la ubicación de WhatsApp o escribe la dirección" />
            <AddressInput label="B · Entrega" value={b} onChange={setB} near={a} placeholder="Pega la ubicación de WhatsApp o escribe la dirección" />
            {!client && (
              <>
                <label className="check">
                  <input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} /> 🌙 Nocturno (desde las {RULES.nightFrom}:00)
                </label>
                <label className="check">
                  <input type="checkbox" checked={weather} onChange={(e) => setWeather(e.target.checked)} /> 🌧️ Lluvia / granizo
                </label>
              </>
            )}
            <PriceBreakdown result={t} showNet={!client} />
          </div>
          {client && (mode === 'straight' ? est : t) && (
            <div className="card">
              <div className="suggested">
                <div className="label">{mode === 'straight' ? 'Precio estimado' : 'Precio sugerido'}</div>
                <div className="amount">{money(mode === 'straight' ? est.mid.total : t.total)}</div>
                {mode === 'straight' ? (
                  <div className="muted sm">
                    {SERVICES[service].label} · ≈ {est.route.est.toFixed(1).replace('.', ',')} km por las calles
                    {est.low.total !== est.high.total && ` · entre ${money(est.low.total)} y ${money(est.high.total)}`}
                    {service === 'errand' ? ' · + el monto de la compra' : ''}
                  </div>
                ) : (
                  <div className="muted sm">
                    {SERVICES[service].label} · {String(t.km).replace('.', ',')} km por la ruta{service === 'errand' ? ' · + el monto de la compra' : ''}
                  </div>
                )}
                {(mode === 'straight' || route?.approx) && (
                  <div className="alert warn sm">
                    {mode === 'straight'
                      ? 'Estimado a partir de tu medida en línea recta. Al marcar las direcciones, la app medirá la ruta exacta por las calles.'
                      : `Sin conexión al servicio de rutas: calculado con línea recta + ${pct(STRAIGHT_TO_ROUTE.est)} %. El repartidor lo confirmará.`}
                  </div>
                )}
              </div>
              <p className="muted sm">
                {night ? `Incluye recargo nocturno de ${money(RULES.surcharge)}. ` : ''}Puede sumarse espera mayor a {RULES.freeWaitMin} min por parada ({money(RULES.waitBlockPrice)} cada 10 min) o {money(RULES.surcharge)} con lluvia/granizo.
              </p>
              <button className="btn primary block lg" onClick={() => onAccept(mode === 'straight' ? { service } : { a, b, service })}>
                ✔ Aceptar y solicitar repartidor
              </button>
            </div>
          )}
          {!client && t && (
            <div className="card">
              <div className="field">
                <label>WhatsApp del cliente (opcional)</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="7 123 4567" />
              </div>
              <a className="btn wa block lg" href={whatsappLink(phone, message)} target="_blank" rel="noreferrer">
                <WhatsAppIcon /> Enviar cotización · {money(t.total)}
              </a>
              {onCreate && (
                <button className="btn block" onClick={() => onCreate({ a, b, service, manualKm })}>
                  ➕ Crear la entrega con estos datos
                </button>
              )}
            </div>
          )}
          <TariffCard forDriver={!client} />
        </div>
      </div>
    </div>
  );
}
