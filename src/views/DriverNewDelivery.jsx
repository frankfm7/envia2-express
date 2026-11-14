import { useEffect, useState } from 'react';
import MapView from '../components/MapView';
import { AddressInput } from '../components/Common';
import { createShipment } from '../lib/store';
import { getRoute, getCurrentPosition, reverseGeocode } from '../lib/geo';
import { BRANDS, SIZES, money } from '../lib/config';
import { computeTariff, isNight, RULES, SERVICES } from '../lib/tariff';
import { RouteDistance, PriceBreakdown, TariffCard } from '../components/Tariff';

/**
 * El REPARTIDOR registra una entrega él mismo. El cliente no necesita la app:
 * recibe el seguimiento y el comprobante por WhatsApp.
 */
export default function DriverNewDelivery({ me, onDone, onCancel, prefill }) {
  const [pickup, setPickup] = useState(prefill?.a || null);
  const [dropoff, setDropoff] = useState(prefill?.b || null);
  const [route, setRoute] = useState(null);
  const [f, setF] = useState({ name: '', phone: '', senderName: '', senderPhone: '', brand: '', orderNo: '', qty: 1, size: 'M', collect: '', notes: '', service: prefill?.service || 'simple', purchase: '', purchaseAmount: '', weather: false, price: '' });
  const [manualKm, setManualKm] = useState(prefill?.manualKm || null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (prefill?.a) return;
    getCurrentPosition().then(async (p) => p && setPickup({ lat: p.lat, lng: p.lng, address: await reverseGeocode(p) }));
  }, []);
  useEffect(() => {
    if (!pickup || !dropoff) return setRoute(null);
    let alive = true;
    getRoute(pickup, dropoff).then((r) => alive && setRoute(r));
    return () => {
      alive = false;
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const km = manualKm || (route ? route.distance / 1000 : null);
  const tariff = km != null ? computeTariff({ km, service: f.service, night: isNight(), weather: f.weather }) : null;
  const finalPrice = f.price !== '' ? Number(f.price) : tariff?.total ?? 0;
  const errand = f.service === 'errand';

  const submit = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2 || f.phone.replace(/\D/g, '').length < 7) return setErr('Escribe nombre y celular de quien recibe (para enviarle el comprobante por WhatsApp).');
    if (!dropoff) return setErr('Indica la dirección de entrega (búscala, usa el GPS o toca el mapa).');
    setBusy(true);
    const sender = { id: me.id, name: f.senderName.trim() || me.name, phone: f.senderPhone.replace(/[^\d+]/g, '') || me.phone };
    const id = await createShipment(
      sender,
      {
        createdByDriver: true,
        kind: f.brand ? 'catalog' : 'direct',
        brand: f.brand || null,
        orderNo: f.orderNo,
        recipient: { name: f.name.trim(), phone: f.phone.replace(/[^\d+]/g, '') },
        pickup: pickup || dropoff,
        dropoff,
        qty: Number(f.qty) || 1,
        size: f.size,
        notes: f.notes,
        service: f.service,
        purchase: errand ? f.purchase.trim() : '',
        purchaseAmount: errand ? Number(f.purchaseAmount) || 0 : 0,
        routeKm: tariff?.km ?? null,
        kmManual: !!manualKm,
        tariff: tariff ? { lines: tariff.lines, total: tariff.total, km: tariff.km, approx: !!route?.approx && !manualKm } : null,
        price: finalPrice,
        collectAmount: f.collect ? String(f.collect) : '',
        payment: f.collect === 'prepaid' ? 'prepaid' : 'cash',
        tripRoute: route,
        driverId: me.id,
        driverName: me.name,
        driverPhone: me.phone,
        vehicle: me.vehicle || '',
        plate: me.plate || '',
      },
      { status: 'picked_up' } // el repartidor ya tiene la caja
    );
    setBusy(false);
    onDone(id);
  };

  return (
    <form className="page" onSubmit={submit}>
      <div className="page-head">
        <button type="button" className="btn ghost" onClick={onCancel}>
          ← Volver
        </button>
        <h2>Nueva entrega</h2>
      </div>
      <p className="muted sm">El cliente no necesita la app: le enviarás el seguimiento y su comprobante firmado por WhatsApp.</p>
      <div className="split">
        <div className="split-map">
          <MapView pickup={pickup} dropoff={dropoff} route={route} onClick={async (p) => setDropoff({ ...p, address: await reverseGeocode(p) })} height={300} />
          <p className="muted sm">Toca el mapa para marcar el punto de entrega (B).</p>
          <div className="card" style={{ marginTop: 10 }}>
            <RouteDistance a={pickup} b={dropoff} route={route} manualKm={manualKm} setManualKm={setManualKm} />
            <label className="check">
              <input type="checkbox" checked={f.weather} onChange={(e) => set('weather', e.target.checked)} /> 🌧️ Lluvia / granizo (+Bs {RULES.surcharge})
            </label>
            <PriceBreakdown result={tariff} showNet />
            <div className="field" style={{ marginTop: 8 }}>
              <label>Precio del envío a cobrar (sugerido {tariff ? money(tariff.total) : '—'})</label>
              <input type="number" min="0" step="0.5" inputMode="decimal" value={f.price} placeholder={tariff ? String(tariff.total) : ''} onChange={(e) => set('price', e.target.value)} />
            </div>
          </div>
          <TariffCard forDriver />
        </div>
        <div className="split-form">
          <div className="card">
            <div className="service-grid">
              {Object.entries(SERVICES).map(([k, v]) => (
                <button type="button" key={k} className={`service ${f.service === k ? 'sel' : ''}`} onClick={() => set('service', k)}>
                  <span>{v.icon}</span>
                  <b>{v.label}</b>
                </button>
              ))}
            </div>
            {errand && (
              <div className="row gap wrap">
                <div className="field grow">
                  <label>¿Qué hay que comprar?</label>
                  <input value={f.purchase} onChange={(e) => set('purchase', e.target.value)} placeholder="Ej. pollo, remedios" />
                </div>
                <div className="field" style={{ width: 130 }}>
                  <label>Monto compra</label>
                  <input type="number" min="0" value={f.purchaseAmount} onChange={(e) => set('purchaseAmount', e.target.value)} placeholder="Bs" />
                </div>
                {Number(f.purchaseAmount) > RULES.errandAdvanceCap && <div className="alert warn sm">Supera Bs {RULES.errandAdvanceCap}: pide pago por QR antes de comprar.</div>}
              </div>
            )}
            <h3>🙋 ¿Quién recibe?</h3>
            <div className="row gap wrap">
              <div className="field grow">
                <label>Nombre</label>
                <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Nombre del cliente" />
              </div>
              <div className="field grow">
                <label>Celular (WhatsApp)</label>
                <input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="7 123 4567" />
              </div>
            </div>
            <AddressInput label="B · Dirección de entrega" value={dropoff} onChange={setDropoff} near={pickup} />
            <div className="field">
              <label>Indicaciones</label>
              <input value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ej. puerta negra, 2do piso" />
            </div>
          </div>

          <div className="card">
            <h3>📦 La caja</h3>
            <div className="chips">
              <button type="button" className={`chip ${!f.brand ? 'on' : ''}`} onClick={() => set('brand', '')}>
                Envío normal
              </button>
              {BRANDS.map((b) => (
                <button key={b} type="button" className={`chip ${f.brand === b ? 'on' : ''}`} onClick={() => set('brand', b)}>
                  {b}
                </button>
              ))}
            </div>
            <div className="row gap wrap">
              <div className="field" style={{ width: 90 }}>
                <label>Cajas</label>
                <input type="number" min="1" value={f.qty} onChange={(e) => set('qty', e.target.value)} />
              </div>
              <div className="field grow">
                <label>Tamaño</label>
                <select value={f.size} onChange={(e) => set('size', e.target.value)}>
                  {Object.entries(SIZES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ width: 130 }}>
                <label>Cobrar producto</label>
                <input type="number" min="0" value={f.collect} onChange={(e) => set('collect', e.target.value)} placeholder="0" />
              </div>
            </div>
            {f.brand && (
              <div className="field">
                <label>N° de pedido</label>
                <input value={f.orderNo} onChange={(e) => set('orderNo', e.target.value)} placeholder="Opcional" />
              </div>
            )}
          </div>

          <div className="card">
            <h3>📍 Recojo / remitente (opcional)</h3>
            <AddressInput label={errand ? "A · Dónde comprar" : "A · Desde dónde sale (por defecto: tu ubicación)"} value={pickup} onChange={setPickup} />
            <div className="row gap wrap">
              <div className="field grow">
                <label>Remitente</label>
                <input value={f.senderName} onChange={(e) => set('senderName', e.target.value)} placeholder="Tienda / persona que envía" />
              </div>
              <div className="field grow">
                <label>Celular remitente</label>
                <input value={f.senderPhone} onChange={(e) => set('senderPhone', e.target.value)} inputMode="tel" />
              </div>
            </div>
          </div>

          {err && <div className="alert error">{err}</div>}
          <button className="btn primary block lg sticky-cta" disabled={busy}>
            {busy ? 'Guardando…' : '🛵 Crear y empezar entrega'}
          </button>
        </div>
      </div>
    </form>
  );
}
