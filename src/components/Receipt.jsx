import { useEffect, useState } from 'react';
import { verifySeal } from '../lib/proof';
import { fmtDate, fmtKm } from '../lib/geo';
import { SIZES, money, PAYMENT_LABEL, BUSINESS_NAME } from '../lib/config';
import { useEvidence, updateShipment, publishPublic, ensurePublicToken, publicLink } from '../lib/store';
import { shareReceipt, sendReceiptLink } from '../lib/receiptImage';
import { Stars, WhatsAppIcon } from './Common';

/** Comprobante de entrega con todas las evidencias. Se comparte como imagen por WhatsApp. */
export default function Receipt({ shipment: s }) {
  const ev = useEvidence(s.id);
  const [valid, setValid] = useState(null);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (ev !== undefined) verifySeal(s, ev).then(setValid);
  }, [s, ev]);
  const p = s.proof || {};
  const deliveredAt = s.events.find((e) => e.status === 'delivered')?.ts;

  const mark = (who) => updateShipment(s.id, { receiptSent: { ...(s.receiptSent || {}), [who]: Date.now() } });
  // Enlace: el cliente ve su comprobante sin tener la app
  const sendLink = async (who, phone) => {
    let sh = s;
    if (!s.publicToken) sh = { ...s, publicToken: await ensurePublicToken(s) };
    sendReceiptLink(sh, publicLink(sh), phone); // primero abrir WhatsApp (el navegador lo exige así)
    publishPublic(sh, ev);
    mark(who);
  };
  const shareImage = async (who, phone) => {
    setBusy(who);
    const r = await shareReceipt(s, ev, valid, phone, s.publicToken ? publicLink(s) : null);
    if (r !== 'cancelled') mark(who);
    setBusy('');
  };

  return (
    <div className="receipt" id="receipt">
      <div className="receipt-head">
        <div>
          <div className="brand-sm">📦 {BUSINESS_NAME}</div>
          <h2>Comprobante de entrega</h2>
          <div className="muted">Guía {s.code}</div>
        </div>
        <div className={`seal ${valid ? 'ok' : valid === false ? 'bad' : ''}`}>
          {valid == null ? 'Verificando…' : valid ? '✔ Evidencia íntegra' : '⚠ Evidencia alterada'}
        </div>
      </div>

      <div className="share-box no-print">
        <b>📤 Enviar copia al cliente (no necesita la app)</b>
        <div className="row gap wrap">
          <button className="btn wa" disabled={ev === undefined} onClick={() => sendLink('recipient', s.recipient?.phone)}>
            <WhatsAppIcon /> Enviar a {s.recipient?.name?.split(' ')[0] || 'quien recibió'}
          </button>
          <button className="btn" disabled={!!busy || ev === undefined} onClick={() => shareImage('recipient', s.recipient?.phone)}>
            🖼️ {busy ? 'Preparando…' : 'Enviar como imagen'}
          </button>
          {s.clientPhone && s.clientPhone !== s.recipient?.phone && s.clientId !== s.driverId && (
            <button className="btn wa" disabled={ev === undefined} onClick={() => sendLink('client', s.clientPhone)}>
              <WhatsAppIcon /> Al remitente
            </button>
          )}
        </div>
        <span className="muted sm">
          Tu constancia ya quedó guardada en tu celular. El mensaje abre WhatsApp con el número del cliente; si no hay señal, WhatsApp lo envía cuando vuelva.
          {s.receiptSent && ` ✔ Enviado ${fmtDate(Math.max(...Object.values(s.receiptSent)))}`}
        </span>
      </div>

      <div className="grid2">
        <section>
          <h4>Envío</h4>
          <dl>
            {s.brand && (
              <>
                <dt>Marca / pedido</dt>
                <dd>
                  {s.brand} {s.orderNo && `· ${s.orderNo}`}
                </dd>
              </>
            )}
            <dt>Remitente</dt>
            <dd>
              {s.clientName} · {s.clientPhone}
            </dd>
            <dt>Origen</dt>
            <dd>{s.pickup?.address}</dd>
            <dt>Destino</dt>
            <dd>{s.dropoff?.address}</dd>
            <dt>Destinatario</dt>
            <dd>
              {s.recipient?.name} · {s.recipient?.phone}
            </dd>
            <dt>Paquete</dt>
            <dd>
              {s.qty} × caja {SIZES[s.size]?.label} {s.weight ? `· ${s.weight} kg` : ''} {s.fragile ? '· Frágil' : ''}
            </dd>
            <dt>Importe</dt>
            <dd>
              {money(s.finalPrice ?? s.price)} · {PAYMENT_LABEL[s.payment]}
              {s.proof?.charge && (s.proof.charge.waitTotal > 0 || s.proof.charge.surcharge > 0) && (
                <div className="muted sm">
                  Acordado {money(s.proof.charge.agreed)}
                  {s.proof.charge.waitTotal > 0 && ` + espera ${money(s.proof.charge.waitTotal)}`}
                  {s.proof.charge.surcharge > 0 && ` + clima ${money(s.proof.charge.surcharge)}`}
                </div>
              )}
              {s.proof?.charge?.purchase > 0 && <div className="sm">🛍️ Compra: {money(s.proof.charge.purchase)}</div>}
              {s.proof?.charge && <div className="sm">Total cobrado: <b>{money(s.proof.charge.total)}</b></div>}
            </dd>
          </dl>
        </section>
        <section>
          <h4>Entrega</h4>
          <dl>
            <dt>Repartidor</dt>
            <dd>
              {s.driverName} · {s.vehicle} {s.plate}
            </dd>
            <dt>Recibió</dt>
            <dd>
              {p.receivedBy} {p.relation ? `(${p.relation})` : ''}
            </dd>
            <dt>Fecha y hora</dt>
            <dd>{deliveredAt ? fmtDate(deliveredAt) : '—'}</dd>
            <dt>Código PIN</dt>
            <dd>{p.pinVerified ? '✔ Verificado' : `✖ Sin PIN — motivo: ${p.noPinReason || '—'}`}</dd>
            <dt>Ubicación GPS</dt>
            <dd>
              {p.pos ? (
                <a href={`https://www.google.com/maps?q=${p.pos.lat},${p.pos.lng}`} target="_blank" rel="noreferrer">
                  {p.pos.lat.toFixed(5)}, {p.pos.lng.toFixed(5)}
                </a>
              ) : (
                '—'
              )}{' '}
              {p.distanceToDropoff != null && <span className={p.distanceToDropoff > 250 ? 'warn' : ''}>· a {fmtKm(p.distanceToDropoff)} del destino</span>}
            </dd>
            <dt>Firma</dt>
            <dd>✔ En el celular del repartidor</dd>
            <dt>Huella / Face ID</dt>
            <dd>{s.clientBiometric ? `✔ Confirmado ${fmtDate(s.clientBiometric.ts)}` : 'Pendiente'}</dd>
            {p.offline && (
              <>
                <dt>Conexión</dt>
                <dd>Registrado sin señal y sincronizado después</dd>
              </>
            )}
            {s.rating && (
              <>
                <dt>Calificación</dt>
                <dd>
                  <Stars value={s.rating} size={16} /> {s.review}
                </dd>
              </>
            )}
          </dl>
        </section>
      </div>

      {ev === undefined ? (
        <div className="muted sm">Cargando fotos y firma…</div>
      ) : (
        <div className="evidence">
          {ev?.pickupPhoto && (
            <figure>
              <img src={ev.pickupPhoto} alt="Foto al recoger" />
              <figcaption>Foto al recoger</figcaption>
            </figure>
          )}
          {ev?.photo && (
            <figure>
              <img src={ev.photo} alt="Foto de entrega" />
              <figcaption>Foto de entrega</figcaption>
            </figure>
          )}
          {ev?.signature && (
            <figure>
              <img src={ev.signature} alt="Firma" className="sig" />
              <figcaption>Firma de {p.signerName || p.receivedBy}</figcaption>
            </figure>
          )}
          {!ev && <div className="muted sm">Las fotos se descargarán cuando haya señal.</div>}
        </div>
      )}
      {p.notes && <p className="muted">Notas del repartidor: {p.notes}</p>}
      {p.hash && (
        <div className="hash">
          Sello digital SHA-256: <code>{p.hash}</code>
        </div>
      )}
    </div>
  );
}
