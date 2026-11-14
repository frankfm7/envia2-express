import { useMemo, useState } from 'react';
import { AddressInput, StatusBadge, WhatsAppIcon, Modal } from '../components/Common';
import { ConfirmMeeting } from './Meeting';
import { createShipment, updateShipment, useStore } from '../lib/store';
import { BRANDS, BUSINESS_NAME, whatsappLink, money, PIN_DISCLAIMER } from '../lib/config';
import { fmtDate } from '../lib/geo';
import { claimLink } from './DeliveryProof';

const WAREHOUSE_KEY = 'boxruta:warehouse';
const loadWarehouse = () => {
  try {
    return JSON.parse(localStorage.getItem(WAREHOUSE_KEY));
  } catch {
    return null;
  }
};

export const arrivalMessage = (s) =>
  `Hola ${s.recipient.name} 👋, te saluda ${BUSINESS_NAME}. Tu caja ${s.brand}${s.orderNo ? ` (pedido ${s.orderNo})` : ''} ya llegó 📦.\n` +
  `Por favor confirma DÓNDE y A QUÉ HORA te la entregamos aquí:\n${claimLink(s)}\n` +
  `\n🔐 *Tu PIN de entrega: ${s.pin}*\n${PIN_DISCLAIMER}`;

/**
 * Cajas de catálogo (Yanbal, Ésika, L'Bel, Cyzone…): registras las cajas que
 * recogiste, avisas a cada consultora por WhatsApp y ella confirma lugar y hora.
 */
export default function CatalogBoxes({ me }) {
  const { shipments } = useStore();
  const [warehouse, setWarehouse] = useState(loadWarehouse);
  const [brand, setBrand] = useState('Yanbal');
  const [form, setForm] = useState({ name: '', phone: '', orderNo: '', qty: 1, collect: '' });
  const [bulk, setBulk] = useState('');
  const [mode, setMode] = useState('one');
  const [filter, setFilter] = useState('awaiting');
  const [confirmFor, setConfirmFor] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const boxes = useMemo(() => shipments.filter((s) => s.kind === 'catalog'), [shipments]);
  const shown = boxes.filter((s) =>
    filter === 'awaiting' ? s.status === 'awaiting_confirmation' : filter === 'confirmed' ? !['awaiting_confirmation', 'delivered', 'cancelled'].includes(s.status) : filter === 'delivered' ? s.status === 'delivered' : true
  );

  const saveWarehouse = (w) => {
    setWarehouse(w);
    localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(w));
  };

  const add = (r) =>
    createShipment(
      me,
      {
        kind: 'catalog',
        brand: r.brand,
        orderNo: r.orderNo || '',
        recipient: { name: r.name.trim(), phone: r.phone.replace(/[^\d+]/g, '') },
        qty: Number(r.qty) || 1,
        size: 'M',
        pickup: warehouse,
        dropoff: null,
        price: Number(r.collect) || 0,
        collectAmount: r.collect ? money(r.collect) : '',
        payment: Number(r.collect) ? 'cash' : 'prepaid',
        notifiedAt: null,
      },
      { status: 'awaiting_confirmation' }
    );

  const addOne = (e) => {
    e.preventDefault();
    if (!warehouse) return alert('Primero indica la dirección de tu almacén (de dónde salen las cajas).');
    if (form.name.trim().length < 2 || form.phone.replace(/\D/g, '').length < 7) return alert('Escribe nombre y celular de la consultora.');
    add({ ...form, brand });
    setForm({ name: '', phone: '', orderNo: '', qty: 1, collect: '' });
  };

  // Pegar desde Excel: Nombre | Celular | Marca | Pedido | Cajas | Monto
  const addBulk = () => {
    if (!warehouse) return alert('Primero indica la dirección de tu almacén.');
    const rows = bulk
      .split('\n')
      .map((l) => l.split(/\t|;|,/).map((x) => x.trim()))
      .filter((c) => c[0] && c[1]);
    rows.forEach(([name, phone, b, orderNo, qty, collect]) => add({ name, phone, brand: BRANDS.find((x) => x.toLowerCase() === (b || '').toLowerCase()) || b || brand, orderNo, qty, collect }));
    setBulk('');
    alert(`${rows.length} caja(s) registradas`);
  };

  const notify = (s) => {
    window.open(whatsappLink(s.recipient.phone, arrivalMessage(s)), '_blank');
    updateShipment(s.id, { notifiedAt: Date.now() });
  };

  const pendingNotify = boxes.filter((s) => s.status === 'awaiting_confirmation' && !s.notifiedAt);

  return (
    <div>
      <div className="card">
        <h3>🏠 Tu almacén / punto de salida</h3>
        <AddressInput label="Desde dónde salen las cajas" value={warehouse} onChange={saveWarehouse} />
      </div>

      <div className="card">
        <h3>📥 Registrar cajas recibidas</h3>
        <div className="seg">
          <button className={mode === 'one' ? 'on' : ''} onClick={() => setMode('one')}>
            Una por una
          </button>
          <button className={mode === 'bulk' ? 'on' : ''} onClick={() => setMode('bulk')}>
            Pegar lista (Excel)
          </button>
        </div>
        <div className="chips">
          {BRANDS.map((b) => (
            <button key={b} type="button" className={`chip ${brand === b ? 'on' : ''}`} onClick={() => setBrand(b)}>
              {b}
            </button>
          ))}
        </div>
        {mode === 'one' ? (
          <form onSubmit={addOne}>
            <div className="row gap wrap">
              <div className="field grow">
                <label>Consultora / cliente</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nombre" />
              </div>
              <div className="field grow">
                <label>Celular (WhatsApp)</label>
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="7 123 4567" />
              </div>
            </div>
            <div className="row gap wrap">
              <div className="field grow">
                <label>N° de pedido / campaña</label>
                <input value={form.orderNo} onChange={(e) => set('orderNo', e.target.value)} placeholder="Opcional" />
              </div>
              <div className="field" style={{ width: 90 }}>
                <label>Cajas</label>
                <input type="number" min="1" value={form.qty} onChange={(e) => set('qty', e.target.value)} />
              </div>
              <div className="field" style={{ width: 130 }}>
                <label>Cobrar (opcional)</label>
                <input type="number" min="0" value={form.collect} onChange={(e) => set('collect', e.target.value)} placeholder="0" />
              </div>
            </div>
            <button className="btn primary block">+ Agregar caja {brand}</button>
          </form>
        ) : (
          <div>
            <p className="muted sm">
              Copia de Excel y pega aquí. Una fila por caja, columnas: <b>Nombre · Celular · Marca · Pedido · Cajas · Monto a cobrar</b> (las últimas son opcionales).
            </p>
            <textarea rows="6" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'María López\t71234567\tYanbal\t12345\t1\t0\nRosa Díaz\t69876543\tÉsika\t555\t2\t35'} />
            <button className="btn primary block" onClick={addBulk} disabled={!bulk.trim()}>
              Registrar lista
            </button>
          </div>
        )}
      </div>

      {!!pendingNotify.length && (
        <div className="alert warn">
          Tienes <b>{pendingNotify.length}</b> consultora(s) sin avisar. Toca "Avisar por WhatsApp" en cada una: les llega el mensaje con el enlace para confirmar lugar y hora.
        </div>
      )}

      <div className="row gap wrap filters">
        {[
          ['awaiting', 'Por confirmar'],
          ['confirmed', 'Confirmadas / en ruta'],
          ['delivered', 'Entregadas'],
          ['all', 'Todas'],
        ].map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
            {l} ({boxes.filter((s) => (k === 'awaiting' ? s.status === 'awaiting_confirmation' : k === 'confirmed' ? !['awaiting_confirmation', 'delivered', 'cancelled'].includes(s.status) : k === 'delivered' ? s.status === 'delivered' : true)).length})
          </button>
        ))}
      </div>
      <div className="list">
        {shown.map((s) => (
          <div key={s.id} className="card ship-card">
            <div className="row between">
              <b>
                <span className="tag brand">{s.brand}</span> {s.recipient.name}
              </b>
              <StatusBadge status={s.status} />
            </div>
            <div className="muted sm">
              {s.recipient.phone} · {s.qty} caja(s) {s.orderNo && `· Pedido ${s.orderNo}`} {s.collectAmount && `· Cobrar ${s.collectAmount}`} · PIN {s.pin}
            </div>
            {s.meeting ? (
              <div className="sm">
                📅 {new Date(s.meeting.date + 'T12:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} {s.meeting.window} · 📍 {s.dropoff?.address}
              </div>
            ) : (
              <div className="sm muted">{s.notifiedAt ? `Avisada ${fmtDate(s.notifiedAt)} · esperando que confirme` : 'Aún no avisada'}</div>
            )}
            {s.recipientUid && <div className="sm">✔ Consultora vinculada a la app</div>}
            <div className="row gap wrap" style={{ marginTop: 8 }}>
              {s.status === 'awaiting_confirmation' && (
                <button className="btn wa sm" onClick={() => notify(s)}>
                  <WhatsAppIcon /> {s.notifiedAt ? 'Volver a avisar' : 'Avisar por WhatsApp'}
                </button>
              )}
              {s.status === 'awaiting_confirmation' && (
                <button className="btn sm" onClick={() => setConfirmFor(s.id)}>
                  📅 Confirmar por ella
                </button>
              )}
              <button className="btn ghost sm" onClick={() => navigator.clipboard?.writeText(claimLink(s)).then(() => alert('Enlace copiado'))}>
                🔗 Copiar enlace
              </button>
              {s.status === 'awaiting_confirmation' && (
                <button className="btn ghost danger sm" onClick={() => confirm('¿Anular esta caja?') && updateShipment(s.id, {}, { status: 'cancelled', note: 'Anulada por el administrador' })}>
                  Anular
                </button>
              )}
            </div>
          </div>
        ))}
        {!shown.length && <div className="card empty">No hay cajas en esta lista.</div>}
      </div>
      {confirmFor && shipments.find((x) => x.id === confirmFor) && (
        <Modal title="Confirmar lugar y hora (acordado por WhatsApp/llamada)" onClose={() => setConfirmFor(null)} wide>
          <ConfirmMeeting s={shipments.find((x) => x.id === confirmFor)} me={me} onBehalf onDone={() => setConfirmFor(null)} />
        </Modal>
      )}
    </div>
  );
}
