import { useEffect, useState } from 'react';
import MapView from '../components/MapView';
import Logo, { LogoFull } from '../components/Logo';
import { StatusBadge, Progress, ContactBar } from '../components/Common';
import { usePublic } from '../lib/store';
import { useEta, arrivalClock } from '../lib/useEta';
import { fmtKm, fmtMin, fmtDate } from '../lib/geo';
import { verifySeal } from '../lib/proof';
import { renderReceipt } from '../lib/receiptImage';
import { BUSINESS_NAME } from '../lib/config';

/**
 * Página que el cliente abre desde WhatsApp. NO necesita la app ni iniciar sesión.
 * Muestra el seguimiento en vivo y, al entregar, el comprobante firmado.
 */
export default function PublicPage({ token }) {
  const s = usePublic(token);
  const eta = useEta(s && s.status ? s : null);
  const [valid, setValid] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (s?.status === 'delivered' && s.proof) verifySeal(s, s.evidence).then(setValid);
  }, [s]);

  if (s === undefined) return <div className="splash muted">Cargando…</div>;
  if (!s)
    return (
      <div className="public">
        <div className="center">
          <LogoFull size={180} />
        </div>
        <div className="card empty-state" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 48 }}>📶</div>
          <h3>Todavía no hay información</h3>
          <p className="muted">El repartidor la publicará en cuanto tenga señal. Vuelve a abrir este enlace en unos minutos.</p>
        </div>
      </div>
    );

  const delivered = s.status === 'delivered';
  const p = s.proof || {};
  const deliveredAt = s.events?.find((e) => e.status === 'delivered')?.ts;

  const download = async () => {
    setBusy(true);
    const blob = await renderReceipt(s, s.evidence, valid, location.href);
    const file = new File([blob], `comprobante-${s.code}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Comprobante ${s.code}` });
      else throw new Error('sin share');
    } catch (e) {
      if (e.name !== 'AbortError') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
      }
    }
    setBusy(false);
  };

  return (
    <div className="public">
      <div className="public-head">
        <Logo size={38} />
        <StatusBadge status={s.status} />
      </div>
      <h2>
        {delivered ? '✅ Tu paquete fue entregado' : s.status === 'cancelled' ? 'Entrega cancelada' : `Hola ${s.recipient?.name?.split(' ')[0] || ''}, tu paquete va en camino`}
      </h2>
      <div className="muted sm">
        Guía {s.code} {s.brand && `· ${s.brand}`} {s.orderNo && `· Pedido ${s.orderNo}`} · {s.qty} caja(s)
      </div>

      {!delivered && s.status !== 'cancelled' && (
        <>
          <MapView dropoff={s.dropoff} driver={s.driverPos} route={s.route || s.tripRoute} height={340} />
          <div className="eta-card">
            {s.status === 'arrived' ? (
              <b className="big">🚪 ¡Tu repartidor llegó!</b>
            ) : (
              <>
                <div className="eta-big">
                  <span className="muted sm">Llega en</span>
                  <b>{fmtMin(eta?.seconds)}</b>
                </div>
                <div className="eta-meta">
                  <div>
                    <span className="muted sm">Hora estimada</span>
                    <b>{eta ? arrivalClock(eta.seconds) : '—'}</b>
                  </div>
                  <div>
                    <span className="muted sm">Distancia</span>
                    <b>{fmtKm(eta?.distance)}</b>
                  </div>
                </div>
              </>
            )}
          </div>
          <Progress shipment={s} />
          {s.driverName && (
            <div className="card driver-card">
              <div className="avatar">{s.driverName[0]}</div>
              <div className="grow">
                <b>{s.driverName}</b>
                <div className="muted sm">
                  {s.vehicle} {s.plate && `· ${s.plate}`}
                </div>
              </div>
              <ContactBar name={s.driverName} phone={s.driverPhone} shipment={s} compact />
            </div>
          )}
          <p className="muted sm center">Esta página se actualiza sola. Última actualización: {fmtDate(s.updatedAt)}</p>
        </>
      )}

      {delivered && (
        <div className="card receipt">
          <div className="receipt-head">
            <div>
              <h3>Comprobante de entrega</h3>
              <div className="muted sm">{BUSINESS_NAME}</div>
            </div>
            <div className={`seal ${valid ? 'ok' : valid === false ? 'bad' : ''}`}>{valid == null ? 'Verificando…' : valid ? '✔ Evidencia íntegra' : '⚠ No verificable'}</div>
          </div>
          <dl>
            <dt>Recibió</dt>
            <dd>
              {p.receivedBy} {p.relation && `(${p.relation})`}
            </dd>
            <dt>Fecha y hora</dt>
            <dd>{deliveredAt ? fmtDate(deliveredAt) : '—'}</dd>
            <dt>Dirección</dt>
            <dd>{s.dropoff?.address}</dd>
            <dt>Repartidor</dt>
            <dd>
              {s.driverName} {s.plate && `· ${s.plate}`}
            </dd>
            <dt>Ubicación</dt>
            <dd>
              {p.pos ? (
                <a href={`https://www.google.com/maps?q=${p.pos.lat},${p.pos.lng}`} target="_blank" rel="noreferrer">
                  Ver en el mapa
                </a>
              ) : (
                '—'
              )}
            </dd>
          </dl>
          <div className="evidence">
            {s.evidence?.photo && (
              <figure>
                <img src={s.evidence.photo} alt="Foto de entrega" />
                <figcaption>Foto de la entrega</figcaption>
              </figure>
            )}
            {s.evidence?.signature && (
              <figure>
                <img src={s.evidence.signature} alt="Firma" className="sig" />
                <figcaption>Firma de {p.receivedBy}</figcaption>
              </figure>
            )}
          </div>
          <button className="btn primary block lg" onClick={download} disabled={busy}>
            {busy ? 'Preparando…' : '⬇️ Guardar comprobante (imagen)'}
          </button>
          {s.driverPhone && (
            <div style={{ marginTop: 10 }}>
              <ContactBar name={s.driverName} phone={s.driverPhone} shipment={s} />
            </div>
          )}
        </div>
      )}
      <p className="muted sm center" style={{ marginTop: 20 }}>
        No necesitas instalar nada. {BUSINESS_NAME}
      </p>
    </div>
  );
}
