import { useState } from 'react';
import { PhotoInput, WhatsAppIcon } from '../components/Common';
import { submitDriverApplication, activateDriver, setViewRole, getOne, updateDriverApplication } from '../lib/store';
import { useEffect } from 'react';
import { compressImage } from '../lib/proof';
import { whatsappLink } from '../lib/config';

const DEPTOS = ['OR', 'LP', 'CB', 'SC', 'PT', 'CH', 'TJ', 'BE', 'PD'];
const VEHICLES = ['Moto', 'Auto', 'Camioneta', 'Bicicleta'];

/** Miniatura chica de la selfie para mostrar en la app (la foto grande queda en la solicitud) */
async function thumb(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  return compressImage(new File([blob], 's.jpg', { type: 'image/jpeg' }), 200, 0.75, false);
}

/**
 * Repartidores: llenan sus datos → el administrador revisa → les da un CÓDIGO de ingreso
 * → con el código se activa su cuenta de repartidor.
 */
export default function DriverApply({ me, go }) {
  const st = me.driverStatus || 'none';
  if (me.role === 'driver' && me.approved) return <DriverData me={me} go={go} />;
  if (st === 'pending') return <Waiting me={me} go={go} />;
  if (st === 'code_sent') return <EnterCode me={me} go={go} />;
  return <ApplyForm me={me} go={go} />;
}

function Waiting({ go }) {
  return (
    <div className="page narrow">
      <div className="card empty-state">
        <div style={{ fontSize: 56 }}>⏳</div>
        <h3>Solicitud enviada</h3>
        <p className="muted">El administrador está revisando tus datos. Cuando te apruebe, recibirás tu <b>código de ingreso</b> (por WhatsApp o en persona) y lo escribirás aquí.</p>
        <button className="btn" onClick={() => go({ name: 'home' })}>
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

function EnterCode({ me, go }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="page narrow">
      <div className="card center">
        <div style={{ fontSize: 48 }}>🔑</div>
        <h3>Ingresa tu código de repartidor</h3>
        <p className="muted sm">Te lo dio el administrador al aprobar tu solicitud.</p>
        <input
          className="pin-input"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          placeholder="••••••"
          aria-label="Código de ingreso"
        />
        {err && <div className="alert error">{err}</div>}
        <button
          className="btn primary block lg"
          disabled={code.length !== 6 || busy}
          onClick={async () => {
            setBusy(true);
            setErr('');
            try {
              await activateDriver(me, code);
              setViewRole(me, 'driver');
              go({ name: 'home' });
            } catch (e) {
              setErr(e.message || 'Código incorrecto');
            }
            setBusy(false);
          }}
        >
          {busy ? 'Verificando…' : 'Activar mi cuenta'}
        </button>
      </div>
    </div>
  );
}

/** Borrador de solicitud guardado en el celular ANTES de iniciar sesión */
export const DRAFT_KEY = 'envia2:driver-draft';
export const loadDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
};
export const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* sin almacenamiento */
  }
};

/** Envía el borrador apenas la persona inicia sesión */
export async function submitDraftIfAny(me) {
  const d = loadDraft();
  if (!d || !me || me.role === 'admin' || (me.role === 'driver' && me.approved)) return false;
  if (['pending', 'code_sent'].includes(me.driverStatus)) {
    clearDraft();
    return false;
  }
  await submitDriverApplication(me, d);
  clearDraft();
  return true;
}

export function ApplyForm({ me, go, onDraft, onBack, initial, onSave }) {
  const [f, setF] = useState(() => initial ? { ...initial, photos: undefined, accept: true } : {
    fullName: me?.name || '',
    ci: '',
    ciExt: 'OR',
    birth: '',
    phone: me?.phone || '',
    homeAddress: '',
    license: '',
    vehicle: 'Moto',
    brand: '',
    color: '',
    plate: '',
    contacts: [
      { name: '', relation: '', phone: '' },
      { name: '', relation: '', phone: '' },
    ],
    accept: false,
  });
  const [photos, setPhotos] = useState(() => ({ selfie: null, ciFront: null, ciBack: null, vehicle: null, license: null, ...(initial?.photos || {}) }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setC = (i, k, v) => setF((x) => ({ ...x, contacts: x.contacts.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  const ph = (k) => (v) => setPhotos((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const need = [
      [f.fullName.trim().length > 4, 'Nombre completo'],
      [/^\d{5,10}$/.test(f.ci.trim()), 'Número de carnet (solo números)'],
      [f.phone.replace(/\D/g, '').length >= 8, 'Celular'],
      [f.homeAddress.trim().length > 4, 'Dirección de domicilio'],
      [f.vehicle === 'Bicicleta' || f.plate.trim().length >= 4, 'Placa del vehículo'],
      [photos.selfie, 'Tu foto'],
      [photos.ciFront && photos.ciBack, 'Fotos del carnet (adelante y atrás)'],
      [photos.vehicle, 'Foto del vehículo'],
      [f.contacts.every((c) => c.name.trim() && c.phone.replace(/\D/g, '').length >= 8), '2 números de confianza (nombre y celular)'],
      [f.accept, 'Aceptar las condiciones'],
    ].filter(([ok]) => !ok);
    if (need.length) return setErr('Falta: ' + need.map((n) => n[1]).join(' · '));
    setBusy(true);
    const app = { ...f, plate: f.plate.toUpperCase(), photos, selfieThumb: await thumb(photos.selfie) };
    if (onSave) {
      await onSave(app);
      setBusy(false);
      return;
    }
    if (onDraft) {
      // Antes de iniciar sesión: se guarda y se envía al confirmar identidad (Google / celular)
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(app));
      } catch {
        setBusy(false);
        return setErr('No hay espacio en el celular para guardar las fotos. Toma fotos más livianas e intenta de nuevo.');
      }
      setBusy(false);
      return onDraft(app);
    }
    await submitDriverApplication(me, app);
    setBusy(false);
    go({ name: 'driver-apply' });
  };

  return (
    <form className="page narrow" onSubmit={submit}>
      <div className="page-head">
        <button type="button" className="btn ghost" onClick={() => (onBack ? onBack() : go({ name: 'settings' }))}>
          ← Volver
        </button>
        <h2>{onSave ? '🛵 Mis datos de repartidor' : '🛵 Quiero ser repartidor'}</h2>
      </div>
      {me?.driverStatus === 'rejected' && <div className="alert warn">Tu solicitud anterior fue rechazada{me.driverRejectReason ? `: ${me.driverRejectReason}` : ''}. Corrige y envía de nuevo.</div>}
      <p className="muted sm">Llena tus datos. El administrador los revisará y te dará un código de ingreso. Tus documentos solo los ve el administrador.</p>

      <div className="card">
        <h3>👤 Datos personales</h3>
        <PhotoInput value={photos.selfie} onChange={ph('selfie')} label="Tu foto (selfie, cara visible)" capture="user" hint="Se abre la cámara frontal" max={700} />
        <div className="field">
          <label>Nombre completo</label>
          <input value={f.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Nombres y apellidos" />
        </div>
        <div className="row gap">
          <div className="field grow">
            <label>N° de carnet (CI)</label>
            <input value={f.ci} onChange={(e) => set('ci', e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="1234567" />
          </div>
          <div className="field" style={{ width: 90 }}>
            <label>Exp.</label>
            <select value={f.ciExt} onChange={(e) => set('ciExt', e.target.value)}>
              {DEPTOS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="row gap">
          <div className="field grow">
            <label>Fecha de nacimiento</label>
            <input type="date" value={f.birth} onChange={(e) => set('birth', e.target.value)} />
          </div>
          <div className="field grow">
            <label>Celular</label>
            <input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="7 123 4567" />
          </div>
        </div>
        <div className="field">
          <label>Dirección de domicilio</label>
          <input value={f.homeAddress} onChange={(e) => set('homeAddress', e.target.value)} placeholder="Zona, calle, número" />
        </div>
        <div className="photo-pair">
          <PhotoInput value={photos.ciFront} onChange={ph('ciFront')} label="Carnet: adelante" compact />
          <PhotoInput value={photos.ciBack} onChange={ph('ciBack')} label="Carnet: atrás" compact />
        </div>
      </div>

      <div className="card">
        <h3>🏍️ Vehículo</h3>
        <div className="chips">
          {VEHICLES.map((v) => (
            <button key={v} type="button" className={`chip ${f.vehicle === v ? 'on' : ''}`} onClick={() => set('vehicle', v)}>
              {v}
            </button>
          ))}
        </div>
        <div className="row gap wrap">
          <div className="field grow">
            <label>Marca / modelo</label>
            <input value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Ej. Honda Wave" />
          </div>
          <div className="field grow">
            <label>Color</label>
            <input value={f.color} onChange={(e) => set('color', e.target.value)} placeholder="Ej. Azul" />
          </div>
          <div className="field grow">
            <label>Placa</label>
            <input value={f.plate} onChange={(e) => set('plate', e.target.value)} placeholder="1234ABC" />
          </div>
        </div>
        <div className="field">
          <label>N° de licencia de conducir (opcional)</label>
          <input value={f.license} onChange={(e) => set('license', e.target.value)} />
        </div>
        <div className="photo-pair">
          <PhotoInput value={photos.vehicle} onChange={ph('vehicle')} label="Foto del vehículo (con la placa)" compact />
          <PhotoInput value={photos.license} onChange={ph('license')} label="Licencia (opcional)" compact />
        </div>
      </div>

      <div className="card">
        <h3>📞 Números de confianza</h3>
        <p className="muted sm">Dos personas que te conozcan (familiar, amigo). Se usan solo en caso de emergencia o verificación.</p>
        {f.contacts.map((c, i) => (
          <div key={i} className="row gap wrap contact-row">
            <div className="field grow">
              <label>Nombre {i + 1}</label>
              <input value={c.name} onChange={(e) => setC(i, 'name', e.target.value)} />
            </div>
            <div className="field" style={{ width: 120 }}>
              <label>Parentesco</label>
              <input value={c.relation} onChange={(e) => setC(i, 'relation', e.target.value)} placeholder="Ej. Madre" />
            </div>
            <div className="field grow">
              <label>Celular</label>
              <input value={c.phone} onChange={(e) => setC(i, 'phone', e.target.value)} inputMode="tel" />
            </div>
          </div>
        ))}
      </div>

      <label className="check">
        <input type="checkbox" checked={f.accept} onChange={(e) => set('accept', e.target.checked)} /> Declaro que mis datos son verdaderos y acepto que el administrador los verifique.
      </label>
      {err && <div className="alert error">{err}</div>}
      <button className="btn primary block lg" disabled={busy}>
        {busy ? 'Guardando…' : onSave ? 'Guardar cambios' : 'Enviar solicitud al administrador'}
      </button>
    </form>
  );
}

/** Mensaje para enviar el código al repartidor por WhatsApp */
export const codeMessage = (name, code) =>
  `Hola ${name.split(' ')[0]} 👋, tu solicitud para ser repartidor de Envia2 Express fue APROBADA ✅.\n` +
  `🔑 Tu código de ingreso es: *${code}*\n` +
  `Entra a la app → Configuración → Trabajar como repartidor → Ingresar código. No lo compartas.`;

export const codeLink = (phone, name, code) => whatsappLink(phone, codeMessage(name, code));
export { WhatsAppIcon };

/** Repartidor aprobado: ver y actualizar sus datos (el administrador recibe el aviso) */
function DriverData({ me, go }) {
  const [app, setApp] = useState(undefined);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    getOne('driverApps', me.id).then((a) => setApp(a || null));
  }, [me.id]);
  if (app === undefined) return <div className="page narrow muted">Cargando tus datos…</div>;
  if (saved)
    return (
      <div className="page narrow">
        <div className="card empty-state">
          <div style={{ fontSize: 48 }}>✅</div>
          <h3>Datos actualizados</h3>
          <p className="muted">El administrador verá los cambios en tu ficha.</p>
          <button className="btn primary" onClick={() => go({ name: 'home' })}>
            Ir al inicio
          </button>
        </div>
      </div>
    );
  return (
    <ApplyForm
      me={me}
      go={go}
      initial={app || { fullName: me.name, phone: me.phone, vehicle: me.vehicle || 'Moto', plate: me.plate || '', contacts: [{ name: '', relation: '', phone: '' }, { name: '', relation: '', phone: '' }] }}
      onBack={() => go({ name: 'settings' })}
      onSave={async (a) => {
        await updateDriverApplication(me, a);
        setSaved(true);
      }}
    />
  );
}
