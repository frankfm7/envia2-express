import { useState } from 'react';
import { useSettings, saveSettings, useStore, uid } from '../lib/store';
import { OFFER_TYPES, offerLive, offerText } from '../lib/offers';
import { money, whatsappLink } from '../lib/config';
import { WhatsAppIcon } from '../components/Common';

const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
const toInput = (ts) => (ts ? new Date(ts - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const fromInput = (v) => (v ? new Date(v).getTime() : null);

/** Administrador: lanzar ofertas (ej. "primera entrega de hoy −30 %") y códigos promocionales */
export default function OffersAdmin() {
  const settings = useSettings();
  const { shipments } = useStore();
  const offers = settings.offers || [];
  const [edit, setEdit] = useState(null);
  const save = (list) => saveSettings({ offers: list });
  const usage = (id) => shipments.filter((s) => s.offer?.id === id && s.status !== 'cancelled');

  const blank = { title: 'Primera entrega de hoy', type: 'first_today', pct: 30, service: 'any', code: '', startsAt: null, endsAt: null, days: [], fromHour: null, toHour: null, oncePerClient: true, active: true };

  if (edit)
    return (
      <div className="card">
        <h3>{edit.id ? 'Editar oferta' : 'Nueva oferta'}</h3>
        <div className="field">
          <label>Tipo</label>
          <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>
            {Object.entries(OFFER_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="row gap wrap">
          <div className="field grow">
            <label>Nombre de la oferta (lo ve el cliente)</label>
            <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Ej. Lunes de envíos" />
          </div>
          <div className="field" style={{ width: 110 }}>
            <label>Descuento %</label>
            <input type="number" min="1" max="100" value={edit.pct} onChange={(e) => setEdit({ ...edit, pct: Math.min(100, Math.max(1, Number(e.target.value) || 0)) })} />
          </div>
        </div>
        {edit.type === 'code' && (
          <div className="row gap wrap">
            <div className="field grow">
              <label>Código</label>
              <input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="Ej. ORURO20" />
            </div>
            <label className="check">
              <input type="checkbox" checked={!!edit.oncePerClient} onChange={(e) => setEdit({ ...edit, oncePerClient: e.target.checked })} /> Una vez por cliente
            </label>
          </div>
        )}
        <div className="field">
          <label>Servicio</label>
          <select value={edit.service} onChange={(e) => setEdit({ ...edit, service: e.target.value })}>
            <option value="any">Todos</option>
            <option value="simple">Solo envío simple</option>
            <option value="errand">Solo mandados</option>
          </select>
        </div>
        <div className="row gap wrap">
          <div className="field grow">
            <label>Desde (opcional)</label>
            <input type="datetime-local" value={toInput(edit.startsAt)} onChange={(e) => setEdit({ ...edit, startsAt: fromInput(e.target.value) })} />
          </div>
          <div className="field grow">
            <label>Hasta (opcional)</label>
            <input type="datetime-local" value={toInput(edit.endsAt)} onChange={(e) => setEdit({ ...edit, endsAt: fromInput(e.target.value) })} />
          </div>
        </div>
        <label className="sm muted">Solo estos días (vacío = todos)</label>
        <div className="chips">
          {DAYS.map((d, i) => (
            <button key={d} type="button" className={`chip ${edit.days?.includes(i) ? 'on' : ''}`} onClick={() => setEdit({ ...edit, days: edit.days?.includes(i) ? edit.days.filter((x) => x !== i) : [...(edit.days || []), i] })}>
              {d}
            </button>
          ))}
        </div>
        <div className="row gap wrap">
          <div className="field grow">
            <label>Desde la hora (opcional)</label>
            <input type="number" min="0" max="23" value={edit.fromHour ?? ''} onChange={(e) => setEdit({ ...edit, fromHour: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Ej. 8" />
          </div>
          <div className="field grow">
            <label>Hasta la hora</label>
            <input type="number" min="1" max="24" value={edit.toHour ?? ''} onChange={(e) => setEdit({ ...edit, toHour: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Ej. 12" />
          </div>
        </div>
        <div className="row gap">
          <button
            className="btn primary grow"
            disabled={!edit.pct || (edit.type === 'code' && !edit.code)}
            onClick={() => {
              const o = { ...edit, id: edit.id || uid('of_'), title: edit.title.trim() || OFFER_TYPES[edit.type] };
              save([...offers.filter((x) => x.id !== o.id), o]);
              setEdit(null);
            }}
          >
            Guardar oferta
          </button>
          <button className="btn ghost" onClick={() => setEdit(null)}>
            Cancelar
          </button>
        </div>
      </div>
    );

  return (
    <div>
      <div className="row between wrap gap">
        <h3 style={{ margin: 0 }}>🏷️ Ofertas y códigos</h3>
        <button className="btn primary" onClick={() => setEdit({ ...blank })}>
          + Nueva oferta
        </button>
      </div>
      <p className="muted sm">Se aplican solas al pedir (un solo descuento por pedido: el mayor). Las ofertas vigentes aparecen en el inicio de los clientes.</p>
      {!offers.length && (
        <div className="card empty">
          Aún no hay ofertas. Ejemplo: <b>Primera entrega del día · 30 %</b>.
        </div>
      )}
      <div className="list">
        {offers.map((o) => {
          const used = usage(o.id);
          const live = offerLive(o);
          return (
            <div key={o.id} className={`card offer-card ${live ? 'live' : ''}`}>
              <div className="row between wrap gap">
                <b>{o.title}</b>
                <span className={`badge`} style={{ '--c': live ? '#16a34a' : '#94a3b8' }}>
                  {live ? 'Activa ahora' : o.active ? 'Programada / fuera de horario' : 'Apagada'}
                </span>
              </div>
              <div className="offer-pct">−{o.pct}%</div>
              <div className="sm">
                {OFFER_TYPES[o.type]}
                {o.type === 'code' && (
                  <>
                    {' '}
                    · código <b>{o.code}</b>
                  </>
                )}
                {o.service !== 'any' && ` · ${o.service === 'errand' ? 'mandados' : 'envío simple'}`}
              </div>
              <div className="muted sm">
                Usada {used.length} vez/veces · descuentos {money(used.reduce((a, s) => a + (s.coupon?.discount || 0), 0))}
              </div>
              <div className="row gap wrap" style={{ marginTop: 8 }}>
                <label className="switch sm-switch">
                  <input type="checkbox" checked={!!o.active} onChange={(e) => save(offers.map((x) => (x.id === o.id ? { ...x, active: e.target.checked } : x)))} />
                  <span />
                  <b>{o.active ? 'Encendida' : 'Apagada'}</b>
                </label>
                <button className="btn ghost sm" onClick={() => setEdit({ ...o })}>
                  Editar
                </button>
                <a className="btn wa sm" href={whatsappLink('', `🎉 ${offerText(o)} — pide en la app Envia2 Express`)} target="_blank" rel="noreferrer">
                  <WhatsAppIcon /> Anunciar
                </a>
                <button className="btn ghost danger sm" onClick={() => confirm('¿Borrar esta oferta?') && save(offers.filter((x) => x.id !== o.id))}>
                  Borrar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
