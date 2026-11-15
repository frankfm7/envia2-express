import { useEffect, useState } from 'react';
import MapView from '../components/MapView';
import { AddressInput, PhotoInput } from '../components/Common';
import { createShipment, saveEvidence, useSettings } from '../lib/store';
import { usePromo } from '../lib/promo';
import { getRoute, getCurrentPosition, reverseGeocode } from '../lib/geo';
import { SIZES, money } from '../lib/config';
import { computeTariff, isNight, RULES, SERVICES, errandAdvance, CONDITIONS } from '../lib/tariff';
import { RouteDistance, PriceBreakdown, TariffCard } from '../components/Tariff';

export default function NewShipment({ me, onDone, onCancel, prefill }) {
  const [pickup, setPickup] = useState(prefill?.a || null);
  const [dropoff, setDropoff] = useState(prefill?.b || null);
  const [pickTarget, setPickTarget] = useState('dropoff');
  const [route, setRoute] = useState(null);
  const [form, setForm] = useState({
    recipientName: '',
    recipientPhone: '',
    selfRecipient: false,
    size: 'M',
    qty: 1,
    weight: '',
    fragile: false,
    service: prefill?.service || 'simple',
    purchase: '',
    purchaseAmount: '',
    content: '',
    notes: '',
    payment: 'cash',
    when: 'now',
    scheduledAt: '',
    declaredValue: '',
    ack: false,
    advancePaid: false,
  });
  const [advanceProof, setAdvanceProof] = useState(null);
  const [couponId, setCouponId] = useState(null);
  const settings = useSettings();
  const promo = usePromo(me);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (prefill?.a) return;
    getCurrentPosition().then(async (p) => {
      if (p) setPickup({ lat: p.lat, lng: p.lng, address: await reverseGeocode(p) });
    });
  }, []);

  useEffect(() => {
    if (!pickup || !dropoff) return setRoute(null);
    let alive = true;
    getRoute(pickup, dropoff).then((r) => alive && setRoute(r));
    return () => {
      alive = false;
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMapClick = async (p) => {
    const point = { ...p, address: await reverseGeocode(p) };
    if (pickTarget === 'pickup') {
      setPickup(point);
      setPickTarget('dropoff');
    } else setDropoff(point);
  };

  // Precio según el tarifario: distancia de la RUTA (no línea recta)
  const when = form.when === 'later' && form.scheduledAt ? new Date(form.scheduledAt).getTime() : Date.now();
  const tariff = route ? computeTariff({ km: route.distance / 1000, service: form.service, night: isNight(when), weightKg: Number(form.weight) || 0 }) : null;
  const coupon = promo?.available.find((c) => c.id === couponId) || null;
  const discount = tariff && coupon ? Math.round(((tariff.total * coupon.pct) / 100) * 10) / 10 : 0;
  const price = tariff ? Math.round((tariff.total - discount) * 10) / 10 : null;
  const errand = form.service === 'errand';
  const purchase = Number(form.purchaseAmount) || 0;
  const advance = errand && tariff ? errandAdvance(purchase, price) : 0;
  const highValue = Number(form.declaredValue) > RULES.maxGoodsValue;

  const submit = async (e) => {
    e.preventDefault();
    const recipient = form.selfRecipient ? { name: me.name, phone: me.phone } : { name: form.recipientName.trim(), phone: form.recipientPhone.replace(/[^\d+]/g, '') };
    if (!pickup || !dropoff) return setErr('Indica el origen y el destino (búscalos o toca el mapa).');
    if (!recipient.name || recipient.phone.replace(/\D/g, '').length < 8) return setErr('Escribe nombre y teléfono de quien recibe.');
    if (form.when === 'later' && !form.scheduledAt) return setErr('Elige fecha y hora de recolección.');
    if (errand && !form.purchase.trim()) return setErr('Escribe qué hay que comprar.');
    if (errand && !purchase) return setErr('Escribe el monto aproximado de la compra.');
    if (errand && !form.advancePaid) return setErr(`Para mandados debes adelantar ${money(advance)} por QR y marcar "Ya pagué el adelanto".`);
    if (!form.ack) return setErr('Confirma que tu envío cumple las condiciones (sin efectivo mayor a Bs 200, documentos de valor, armas ni artículos prohibidos).');
    const id = await createShipment(me, {
      pickup,
      dropoff,
      recipient,
      selfRecipient: form.selfRecipient,
      size: form.size,
      qty: Number(form.qty) || 1,
      weight: form.weight,
      fragile: form.fragile,
      service: form.service,
      purchase: errand ? form.purchase.trim() : '',
      purchaseAmount: errand ? Number(form.purchaseAmount) || 0 : 0,
      routeKm: tariff.km,
      tariff: { lines: tariff.lines, total: tariff.total, km: tariff.km, approx: !!route.approx },
      originalPrice: tariff.total,
      coupon: coupon ? { id: coupon.id, pct: coupon.pct, label: coupon.label, discount } : null,
      declaredValue: Number(form.declaredValue) || 0,
      highValue,
      advance: errand ? { amount: advance, paid: true, hasProof: !!advanceProof, at: Date.now() } : null,
      content: form.content,
      notes: form.notes,
      payment: form.payment,
      scheduledAt: form.when === 'later' ? new Date(form.scheduledAt).getTime() : null,
      price,
      tripRoute: route,
    });
    if (advanceProof) saveEvidence(id, { advanceProof });
    onDone(id);
  };

  return (
    <form className="page new-shipment" onSubmit={submit}>
      <div className="page-head">
        <button type="button" className="btn ghost" onClick={onCancel}>
          ← Volver
        </button>
        <h2>Nuevo envío</h2>
      </div>

      <div className="split">
        <div className="split-map">
          <div className="seg">
            <button type="button" className={pickTarget === 'pickup' ? 'on' : ''} onClick={() => setPickTarget('pickup')}>
              Tocar mapa: <b>A · Origen</b>
            </button>
            <button type="button" className={pickTarget === 'dropoff' ? 'on' : ''} onClick={() => setPickTarget('dropoff')}>
              Tocar mapa: <b>B · Destino</b>
            </button>
          </div>
          <MapView pickup={pickup} dropoff={dropoff} route={route} onClick={onMapClick} height={380} />
          <div className="card" style={{ marginTop: 10 }}>
            <RouteDistance a={pickup} b={dropoff} route={route} allowManual={false} />
            <PriceBreakdown result={tariff} />
            {coupon && (
              <div className="breakdown coupon-line">
                <div className="row between">
                  <span>🎫 Cupón {coupon.pct === 100 ? 'envío gratis' : `${coupon.pct} %`}</span>
                  <b>− {money(discount)}</b>
                </div>
                <div className="row between total">
                  <span>Pagas por el envío</span>
                  <b>{money(price)}</b>
                </div>
              </div>
            )}
            <p className="muted sm">
              Pueden sumarse: espera mayor a {RULES.freeWaitMin} min por parada (Bs {RULES.waitBlockPrice} cada 10 min) y Bs {RULES.surcharge} con lluvia/granizo.
            </p>
          </div>
          <TariffCard />
        </div>

        <div className="split-form">
          <div className="card">
            <h3>🛵 ¿Qué servicio necesitas?</h3>
            <div className="service-grid">
              {Object.entries(SERVICES).map(([k, v]) => (
                <button type="button" key={k} className={`service ${form.service === k ? 'sel' : ''}`} onClick={() => set('service', k)}>
                  <span>{v.icon}</span>
                  <b>{v.label}</b>
                  <span className="muted sm">{v.desc}</span>
                </button>
              ))}
            </div>
            {errand && (
              <>
                <div className="field">
                  <label>¿Qué compramos?</label>
                  <textarea rows="2" value={form.purchase} onChange={(e) => set('purchase', e.target.value)} placeholder="Ej. 1/4 de pollo con papas, 1 paracetamol 500 mg" />
                </div>
                <div className="field">
                  <label>Monto aproximado de la compra (Bs)</label>
                  <input type="number" min="0" inputMode="decimal" value={form.purchaseAmount} onChange={(e) => set('purchaseAmount', e.target.value)} placeholder="Ej. 35" />
                  <span className="sm muted">El repartidor no pone su dinero: adelantas por QR al menos el 50 % de la compra (y nunca menos que el envío).</span>
                </div>
              </>
            )}
            <h3>📍 Direcciones</h3>
            <AddressInput label={errand ? 'A · Dónde comprar' : 'A · Recoger en'} value={pickup} onChange={setPickup} />
            <AddressInput label="B · Entregar en" value={dropoff} onChange={setDropoff} near={pickup} />
          </div>

          <div className="card">
            <h3>🙋 ¿Quién recibe?</h3>
            <label className="check">
              <input type="checkbox" checked={form.selfRecipient} onChange={(e) => set('selfRecipient', e.target.checked)} /> Yo mismo recibo
            </label>
            {!form.selfRecipient && (
              <div className="row gap">
                <div className="field grow">
                  <label>Nombre</label>
                  <input value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} placeholder="Nombre de quien recibe" />
                </div>
                <div className="field grow">
                  <label>Teléfono / WhatsApp</label>
                  <input value={form.recipientPhone} onChange={(e) => set('recipientPhone', e.target.value)} inputMode="tel" placeholder="7 123 4567" />
                </div>
              </div>
            )}
          </div>

          <div className="card" hidden={errand}>
            <h3>📦 Tu caja</h3>
            <div className="size-grid">
              {Object.entries(SIZES).map(([k, s]) => (
                <button type="button" key={k} className={`size ${form.size === k ? 'sel' : ''}`} onClick={() => set('size', k)}>
                  <span>{s.icon}</span>
                  <b>{s.label}</b>
                  <span className="muted sm">{s.desc}</span>
                </button>
              ))}
            </div>
            <div className="row gap">
              <div className="field">
                <label>Cajas</label>
                <input type="number" min="1" max="50" value={form.qty} onChange={(e) => set('qty', e.target.value)} />
              </div>
              <div className="field">
                <label>Peso total (kg)</label>
                <input type="number" min="0" step="0.5" value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="field">
              <label>Contenido</label>
              <input value={form.content} onChange={(e) => set('content', e.target.value)} placeholder="Ej. ropa, documentos, electrónicos" />
            </div>
            <label className="check">
              <input type="checkbox" checked={form.fragile} onChange={(e) => set('fragile', e.target.checked)} /> Frágil — manejar con cuidado
            </label>
          </div>

          <div className="card">
            <h3>🕑 Cuándo y pago</h3>
            <div className="seg">
              <button type="button" className={form.when === 'now' ? 'on' : ''} onClick={() => set('when', 'now')}>
                Ahora
              </button>
              <button type="button" className={form.when === 'later' ? 'on' : ''} onClick={() => set('when', 'later')}>
                Programar
              </button>
            </div>
            {form.when === 'later' && (
              <div className="field">
                <label>Fecha y hora de recolección</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} />
              </div>
            )}
            <div className="field">
              <label>Método de pago</label>
              <select value={form.payment} onChange={(e) => set('payment', e.target.value)}>
                <option value="cash">Efectivo al repartidor</option>
                <option value="transfer">Transferencia / QR</option>
                <option value="card">Tarjeta</option>
              </select>
            </div>
            <div className="field">
              <label>Indicaciones para el repartidor</label>
              <textarea rows="2" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ej. portón negro, tocar 2 veces, piso 3" />
            </div>
          </div>

          {!!promo?.available.length && (
            <div className="card">
              <h3>🎫 Usar un cupón</h3>
              <div className="coupon-pick">
                {promo.available.map((c) => (
                  <button type="button" key={c.id} className={`ticket ${c.pct === 100 ? 'gold' : ''} ${couponId === c.id ? 'sel' : ''}`} onClick={() => setCouponId(couponId === c.id ? null : c.id)}>
                    <div className="ticket-left">
                      <b>{c.pct === 100 ? 'GRATIS' : `${c.pct}%`}</b>
                      <small>{couponId === c.id ? '✔ aplicado' : 'tocar para usar'}</small>
                    </div>
                    <div className="ticket-right">
                      <b>{c.label}</b>
                      <span className="muted sm">{c.source}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {errand && tariff && (
            <div className="card advance-card">
              <h3>💳 Adelanto por QR</h3>
              <p className="sm">
                Adelanta <b>{money(advance)}</b> ({purchase ? `50 % de la compra de ${money(purchase)}` : 'monto de la compra'}, mínimo el costo del envío). El saldo de <b>{money(Math.max(0, price + purchase - advance))}</b> lo pagas al recibir.
              </p>
              {settings.qrImage ? (
                <div className="qr-box">
                  <img src={settings.qrImage} alt="QR de pago" />
                  {settings.qrName && <div className="sm">{settings.qrName}</div>}
                </div>
              ) : (
                <div className="alert warn sm">El QR de pago te lo enviaremos por WhatsApp.</div>
              )}
              <PhotoInput value={advanceProof} onChange={setAdvanceProof} label="Foto del comprobante (opcional)" capture="" hint="Captura o foto del pago" compact />
              <label className="check">
                <input type="checkbox" checked={form.advancePaid} onChange={(e) => set('advancePaid', e.target.checked)} /> Ya pagué el adelanto de {money(advance)}
              </label>
            </div>
          )}

          <div className="card">
            <h3>📋 Condiciones</h3>
            <div className="field">
              <label>Valor aproximado de lo que envías (Bs)</label>
              <input type="number" min="0" inputMode="decimal" value={form.declaredValue} onChange={(e) => set('declaredValue', e.target.value)} placeholder="Opcional" />
              {highValue && <span className="sm warn">Más de Bs {RULES.maxGoodsValue}: se cotiza aparte. Te contactaremos para acordar el precio.</span>}
            </div>
            {Number(form.weight) > RULES.heavyKg && <div className="alert warn sm">Bulto de más de {RULES.heavyKg} kg: +Bs {RULES.heavySurcharge} (ya incluido).</div>}
            <details className="howto">
              <summary>Ver las condiciones del servicio</summary>
              <ol className="sm">
                {CONDITIONS.map(([t, d]) => (
                  <li key={t}>
                    <b>{t}:</b> {d}
                  </li>
                ))}
              </ol>
            </details>
            <label className="check">
              <input type="checkbox" checked={form.ack} onChange={(e) => set('ack', e.target.checked)} /> Acepto las condiciones: no envío efectivo mayor a Bs {RULES.maxCash}, documentos de valor, armas ni artículos prohibidos.
            </label>
          </div>

          {err && <div className="alert error">{err}</div>}
          <button className="btn primary block lg sticky-cta" disabled={!route}>
            {route ? `Solicitar ${errand ? 'mandado' : 'envío'} · ${money(price)}${errand && purchase ? ' + compra' : ''}` : 'Elige origen y destino'}
          </button>
        </div>
      </div>
    </form>
  );
}
