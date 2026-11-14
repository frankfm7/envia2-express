import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUS } from '../lib/store';
import { whatsappLink, BUSINESS_NAME } from '../lib/config';
import { fmtClock, fmtDate, searchAddress, reverseGeocode, getCurrentPosition, parseLatLng, isShortMapsLink } from '../lib/geo';
import { compressImage } from '../lib/proof';

export function StatusBadge({ status }) {
  const s = STATUS[status];
  return (
    <span className="badge" style={{ '--c': s?.color }}>
      {s?.label || status}
    </span>
  );
}

const STEPS = [
  ['pending', 'Solicitado', '📝'],
  ['accepted', 'Asignado', '🛵'],
  ['picked_up', 'Recogido', '📦'],
  ['in_transit', 'En camino', '🚀'],
  ['arrived', 'En la puerta', '🚪'],
  ['delivered', 'Entregado', '✅'],
];

export function Progress({ shipment }) {
  const cur = STATUS[shipment.status]?.step ?? 0;
  return (
    <div className="progress">
      {STEPS.map(([key, label, icon], i) => {
        const ev = shipment.events.find((e) => e.status === key);
        return (
          <div key={key} className={`progress-step ${i <= cur ? 'done' : ''} ${i === cur ? 'current' : ''}`}>
            <div className="progress-dot">{icon}</div>
            <div className="progress-label">{label}</div>
            <div className="progress-time">{ev ? fmtClock(ev.ts) : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Timeline({ shipment }) {
  return (
    <ol className="timeline">
      {[...shipment.events].reverse().map((e, i) => (
        <li key={i}>
          <span className="tl-dot" style={{ background: STATUS[e.status]?.color }} />
          <div>
            <b>{STATUS[e.status]?.label}</b>
            {e.note && <span className="muted"> · {e.note}</span>}
            <div className="muted sm">{fmtDate(e.ts)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Botones de contacto: llamada normal, WhatsApp (chat y llamada) y SMS */
export function ContactBar({ name, phone, shipment, compact }) {
  if (!phone) return null;
  const text = `Hola ${name}, te escribo por el envío ${shipment.code} de ${BUSINESS_NAME}.`;
  return (
    <div className={`contact-bar ${compact ? 'compact' : ''}`}>
      <a className="btn call" href={`tel:${phone}`} aria-label={`Llamar a ${name}`}>
        📞 {!compact && 'Llamar'}
      </a>
      <a className="btn wa" href={whatsappLink(phone, text)} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${name}`}>
        <WhatsAppIcon /> {!compact && 'WhatsApp'}
      </a>
      <a className="btn ghost" href={`sms:${phone}?body=${encodeURIComponent(text)}`} aria-label={`SMS a ${name}`}>
        ✉️ {!compact && 'SMS'}
      </a>
    </div>
  );
}

export const WhatsAppIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.7.1a8.2 8.2 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.5l-1-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.3 3.3 0 0 0-1 2.5 5.8 5.8 0 0 0 1.2 3.1 13.3 13.3 0 0 0 5.1 4.5c1.9.8 2.6.9 3.6.7a3 3 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3M12 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8m8.4-18.2A11.8 11.8 0 0 0 1.8 17.8L.1 24l6.3-1.7a11.8 11.8 0 0 0 5.6 1.4 11.8 11.8 0 0 0 8.4-20.1" />
  </svg>
);

/** Buscador de direcciones con botón "usar mi ubicación". */
export function AddressInput({ label, value, onChange, near, placeholder }) {
  const [q, setQ] = useState(value?.address || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => setQ(value?.address || ''), [value?.address]);

  useEffect(() => {
    // ¿Pegaron una ubicación de WhatsApp / Google Maps o coordenadas?
    const ll = parseLatLng(q);
    if (ll && q !== value?.address) {
      setResults([]);
      reverseGeocode(ll).then((address) => onChange({ ...ll, address }));
      return;
    }
    if (!q || q === value?.address || q.length < 4) return setResults([]);
    const t = setTimeout(async () => {
      setLoading(true);
      setResults(await searchAddress(q, near));
      setLoading(false);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const useGps = async () => {
    setLoading(true);
    const p = await getCurrentPosition();
    if (p) onChange({ lat: p.lat, lng: p.lng, address: await reverseGeocode(p) });
    else alert('No se pudo obtener tu ubicación. Activa el GPS y da permiso al navegador.');
    setLoading(false);
  };

  return (
    <div className="field addr">
      <label>{label}</label>
      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder || 'Dirección, o pega la ubicación de WhatsApp / Google Maps'} />
        <button type="button" className="btn ghost icon" onClick={useGps} title="Usar mi ubicación">
          📍
        </button>
      </div>
      {loading && <div className="muted sm">Buscando…</div>}
      {isShortMapsLink(q) && (
        <div className="alert warn sm">Ese enlace corto no trae coordenadas. Ábrelo en Google Maps, mantén presionado el punto y copia las coordenadas (ej. -17.96, -67.10).</div>
      )}
      {!!results.length && (
        <ul className="addr-results">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onChange(r);
                  setResults([]);
                }}
              >
                {r.address}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PhotoInput({ value, onChange, label = 'Tomar foto' }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="photo-input">
      {value ? (
        <div className="photo-preview">
          <img src={value} alt="Foto de evidencia" />
          <button type="button" className="btn ghost sm" onClick={() => onChange(null)}>
            Repetir foto
          </button>
        </div>
      ) : (
        <label className="photo-drop">
          <span style={{ fontSize: 34 }}>📸</span>
          <b>{busy ? 'Procesando…' : label}</b>
          <span className="muted sm">Se abre la cámara del teléfono</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              onChange(await compressImage(f));
              setBusy(false);
            }}
          />
        </label>
      )}
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 28 }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" style={{ fontSize: size }} className={n <= value ? 'on' : ''} onClick={() => onChange?.(n)} disabled={!onChange} aria-label={`${n} estrellas`}>
          ★
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
