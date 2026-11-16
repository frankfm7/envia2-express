import { useEffect, useState } from 'react';
import SignaturePad from '../components/SignaturePad';
import { PhotoInput } from '../components/Common';
import { updateShipment, saveEvidence, useEvidence, publishPublic, getState } from '../lib/store';
import { distance, fmtKm, getCurrentPosition } from '../lib/geo';
import { computeSeal, biometricAvailable, biometricConfirm } from '../lib/proof';
import { DELIVERY_RADIUS_M, money, whatsappLink, pinMessage } from '../lib/config';
import { waitCharge, RULES } from '../lib/tariff';
import { WhatsAppIcon } from '../components/Common';

export const claimLink = (s) => `${location.origin}${location.pathname}#/c/${s.id}/${s.claimToken}`;

const RELATIONS = ['Titular', 'Familiar', 'Portero / Recepción', 'Vecino', 'Compañero de trabajo', 'Otro'];
const STEPS = ['Quién recibe', 'PIN', 'Foto', 'Firma', 'Confirmar'];

/** Asistente de prueba de entrega: receptor → PIN → foto → firma → GPS + sello + huella del repartidor */
export default function DeliveryProof({ s, me, onDone, onCancel }) {
  const [step, setStep] = useState(0);
  const [receivedBy, setReceivedBy] = useState(s.recipient.name);
  const [relation, setRelation] = useState('Titular');
  const [pinInput, setPinInput] = useState('');
  // Si el cliente no usa la app no conoce el PIN: queda como opcional.
  // El PIN es OBLIGATORIO: confirma que quien recibe es el cliente correcto.
  const [tries, setTries] = useState(0);
  const MAX_TRIES = 5;
  const [photo, setPhoto] = useState(null);
  const [signature, setSignature] = useState(null);
  const prevEv = useEvidence(s.id);
  const [notes, setNotes] = useState('');
  const [cashOk, setCashOk] = useState(false);
  // ── Cobro final: tiempos de espera medidos por la app (10 min gratis por parada) ──
  const arrivedTs = s.events?.find((e) => e.status === 'arrived')?.ts;
  const pickupTs = s.events?.find((e) => e.status === 'picked_up')?.ts;
  const [waitPickup, setWaitPickup] = useState(() => (s.pickupArrivedAt && pickupTs ? Math.max(0, Math.round((pickupTs - s.pickupArrivedAt) / 60000)) : 0));
  // Espera en la entrega: desde que el repartidor tocó "Esperando para entregar" (no desde que llegó)
  const [waitDrop, setWaitDrop] = useState(() => (s.dropWaitAt ? Math.max(0, Math.round((Date.now() - s.dropWaitAt) / 60000)) : 0));
  const quotedSurcharge = (s.tariff?.lines || []).some((l) => l.label.startsWith('Recargo'));
  const [weather, setWeather] = useState(false);
  const [purchaseReal, setPurchaseReal] = useState(s.purchaseAmount || '');
  const wp = waitCharge(waitPickup);
  const wd = waitCharge(waitDrop);
  const extraSurcharge = weather && !quotedSurcharge ? RULES.surcharge : 0;
  const shippingTotal = (Number(s.price) || 0) + wp.amount + wd.amount + extraSurcharge;
  const purchase = s.service === 'errand' ? Number(purchaseReal) || 0 : 0;
  const productCollect = Number(s.collectAmount) || 0;
  const advancePaid = s.advance?.paid ? Number(s.advance.amount) || 0 : 0; // adelanto por QR (mandados)
  const toCollect = Math.max(0, (s.payment === 'prepaid' ? purchase + productCollect : shippingTotal + purchase + productCollect) - advancePaid);
  const [bio, setBio] = useState(false);
  const [useBio, setUseBio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    biometricAvailable().then(setBio);
  }, []);

  const pinOk = pinInput === s.pin;
  const pos = s.driverPos;
  const dist = pos ? distance(pos, s.dropoff) : null;

  const can = [receivedBy.trim().length > 1, pinOk, !!photo, !!signature, (cashOk || toCollect === 0) && prevEv !== undefined][step];

  const finish = async () => {
    setBusy(true);
    setErr('');
    try {
      // En modo simulación usamos la posición simulada; con GPS real pedimos una lectura fresca.
      const gps = pos?.simulated ? pos : (await getCurrentPosition()) || pos;
      const p = gps ? { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy } : null;
      let driverBiometric = null;
      if (bio && useBio) driverBiometric = await biometricConfirm(me, `${s.code}|entregado|${Date.now()}`);
      const proof = {
        receivedBy: receivedBy.trim(),
        relation,
        pinVerified: pinOk,
        pinAttempts: tries + (pinOk ? 1 : 0),
        signatureMode: 'driver_device',
        signaturePending: false,
        notes,
        offline: !navigator.onLine,
        cashCollected: s.payment === 'cash' || s.payment === 'prepaid' ? toCollect : null,
        charge: {
          agreed: Number(s.price) || 0,
          waitPickupMin: waitPickup,
          waitDropMin: waitDrop,
          waitTotal: wp.amount + wd.amount,
          surcharge: extraSurcharge,
          shipping: shippingTotal,
          purchase,
          product: productCollect,
          advance: advancePaid,
          coupon: s.coupon || null,
          total: toCollect,
        },
        pos: p,
        distanceToDropoff: p ? Math.round(distance(p, s.dropoff)) : null,
        driverBiometric,
        ts: Date.now(),
        device: navigator.userAgent.slice(0, 120),
      };
      const evidence = { ...(prevEv || {}), photo, signature };
      proof.hash = await computeSeal(s, proof, evidence);
      saveEvidence(s.id, { photo, signature });
      updateShipment(s.id, { proof, finalPrice: shippingTotal }, { status: 'delivered', note: `Recibió ${proof.receivedBy}`, pos: p });
      // Copia pública para el cliente (se sube sola cuando haya señal)
      const fresh = getState().shipments.find((x) => x.id === s.id) || s;
      publishPublic({ ...fresh, status: 'delivered', proof, events: [...(fresh.events || []), { status: 'delivered', ts: Date.now() }] }, evidence);
      onDone();
    } catch (e) {
      setErr('No se pudo completar: ' + (e.message || e));
    }
    setBusy(false);
  };

  return (
    <div className="proof">
      <div className="stepper">
        {STEPS.map((t, i) => (
          <div key={t} className={`st ${i < step ? 'done' : ''} ${i === step ? 'cur' : ''}`}>
            <span>{i < step ? '✓' : i + 1}</span>
            <small>{t}</small>
          </div>
        ))}
      </div>

      {dist != null && dist > DELIVERY_RADIUS_M && (
        <div className="alert warn">
          ⚠️ Estás a {fmtKm(dist)} del destino. La entrega quedará marcada con esta distancia en el comprobante.
        </div>
      )}

      {step === 0 && (
        <div>
          <div className="field">
            <label>Nombre de quien recibe</label>
            <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
          </div>
          <div className="chips">
            {RELATIONS.map((r) => (
              <button key={r} type="button" className={`chip ${relation === r ? 'on' : ''}`} onClick={() => setRelation(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="center">
          <p>
            Pide a <b>{receivedBy}</b> su <b>PIN de 4 dígitos</b>. Puede escribirlo él mismo en tu celular.
          </p>
          <input
            className={`pin-input ${pinInput.length === 4 ? (pinOk ? 'ok' : 'bad') : ''}`}
            value={pinInput}
            disabled={tries >= MAX_TRIES && !pinOk}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setPinInput(v);
              if (v.length === 4 && v !== s.pin) setTries((t) => t + 1);
            }}
            inputMode="numeric"
            type="password"
            placeholder="••••"
            autoFocus
            aria-label="PIN de entrega"
          />
          {pinInput.length === 4 && <div className={pinOk ? 'ok-text' : 'bad-text'}>{pinOk ? '✔ PIN correcto' : '✖ PIN incorrecto'}</div>}
          {tries > 0 && !pinOk && <div className="pin-tries">Intentos fallidos: {tries} de {MAX_TRIES}</div>}
          {tries >= MAX_TRIES && !pinOk && (
            <div className="alert error">Demasiados intentos. No entregues el paquete: comunícate con la central o con el remitente.</div>
          )}
          <div className="alert warn sm" style={{ textAlign: 'left' }}>
            Sin PIN correcto <b>no se puede entregar</b>. Si el cliente no lo tiene, reenvíalo a su número registrado (llega solo a su WhatsApp):
            <a className="btn wa sm block" target="_blank" rel="noreferrer" href={whatsappLink(s.recipient.phone, pinMessage(s))}>
              <WhatsAppIcon /> Reenviar PIN a {s.recipient.phone}
            </a>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="muted">Toma una foto de la caja entregada (idealmente con la puerta o el número de casa visible).</p>
          <PhotoInput value={photo} onChange={setPhoto} label="Foto de la entrega" />
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="muted sm">
            Pide a <b>{receivedBy}</b> que firme con el dedo en <b>tu celular</b>. Es tu constancia de entrega y funciona <b>sin señal</b>: al cliente le llega su copia cuando haya internet.
          </p>
          <SignaturePad onChange={setSignature} />
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="summary">
            <div>
              👤 {receivedBy} ({relation})
            </div>
            <div>🔐 PIN verificado</div>
            <div className="row gap">
              {photo && <img src={photo} alt="" className="thumb" />}
              {signature && <img src={signature} alt="" className="thumb sig" />}
            </div>
            <div>📍 Se guardará tu ubicación GPS, fecha y hora, y un sello digital anti-alteración.</div>
            <div className="alert info sm">📸 Pide al cliente que revise el paquete ahora: los reclamos por faltantes o daños solo se aceptan en el momento de la entrega.</div>
          </div>
          <div className="charge">
            <b>💰 Cobro final</b>
            <div className="row between">
              <span>Envío acordado</span>
              <b>{money(s.price)}</b>
            </div>
            <div className="row between gap">
              <span>
                Espera en recojo{' '}
                <input className="mini" type="number" min="0" value={waitPickup} onChange={(e) => setWaitPickup(Number(e.target.value) || 0)} aria-label="Minutos de espera en recojo" /> min
              </span>
              <b>{wp.amount ? money(wp.amount) : 'gratis'}</b>
            </div>
            <div className="row between gap">
              <span>
                Espera en entrega{' '}
                <input className="mini" type="number" min="0" value={waitDrop} onChange={(e) => setWaitDrop(Number(e.target.value) || 0)} aria-label="Minutos de espera en entrega" /> min
              </span>
              <b>{wd.amount ? money(wd.amount) : 'gratis'}</b>
            </div>
            {!quotedSurcharge && (
              <label className="check">
                <input type="checkbox" checked={weather} onChange={(e) => setWeather(e.target.checked)} /> 🌧️ Lluvia / granizo (+{money(RULES.surcharge)})
              </label>
            )}
            {s.service === 'errand' && (
              <div className="row between gap">
                <span>
                  Compra (según ticket) <input className="mini wide" type="number" min="0" value={purchaseReal} onChange={(e) => setPurchaseReal(e.target.value)} aria-label="Monto de la compra" />
                </span>
                <b>{money(purchase)}</b>
              </div>
            )}
            {!!productCollect && (
              <div className="row between">
                <span>Cobro del producto</span>
                <b>{money(productCollect)}</b>
              </div>
            )}
            {!!s.coupon && (
              <div className="row between">
                <span>🎫 Cupón {s.coupon.pct === 100 ? 'envío gratis' : `${s.coupon.pct} %`} (ya descontado)</span>
                <b>− {money(s.coupon.discount)}</b>
              </div>
            )}
            {!!advancePaid && (
              <div className="row between">
                <span>💳 Adelanto pagado por QR</span>
                <b>− {money(advancePaid)}</b>
              </div>
            )}
            <div className="row between total">
              <span>Total a cobrar</span>
              <b>{money(toCollect)}</b>
            </div>
            <span className="muted sm">Espera: {RULES.freeWaitMin} min gratis por parada; luego {money(RULES.waitBlockPrice)} cada 10 min. Los minutos se midieron con el GPS; puedes corregirlos.</span>
          </div>
          {toCollect > 0 && (
            <label className="check">
              <input type="checkbox" checked={cashOk} onChange={(e) => setCashOk(e.target.checked)} /> Cobré {money(toCollect)}
            </label>
          )}
          {bio && (
            <label className="check">
              <input type="checkbox" checked={useBio} onChange={(e) => setUseBio(e.target.checked)} /> 👆 Firmar como repartidor con mi huella / Face ID
            </label>
          )}
          <div className="field">
            <label>Notas (opcional)</label>
            <textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. caja con golpe leve en una esquina" />
          </div>
        </div>
      )}

      {err && <div className="alert error">{err}</div>}

      <div className="row between proof-nav">
        <button type="button" className="btn ghost" onClick={() => (step ? setStep(step - 1) : onCancel())}>
          {step ? '← Atrás' : 'Cancelar'}
        </button>
        {step < 4 ? (
          <button type="button" className="btn primary" disabled={!can} onClick={() => setStep(step + 1)}>
            Siguiente →
          </button>
        ) : (
          <button type="button" className="btn success lg" disabled={!can || busy} onClick={finish}>
            {busy ? 'Guardando…' : '✅ Confirmar entrega'}
          </button>
        )}
      </div>
    </div>
  );
}
