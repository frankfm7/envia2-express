import { useEffect, useState } from 'react';
import MapView from '../components/MapView';
import { AddressInput } from '../components/Common';
import { TariffCard } from '../components/Tariff';
import { PatternPad, PinPad } from '../components/AppLock';
import { updateUser, logout, allowedRoles, getViewRole, setViewRole, ROLE_LABEL, saveAddress, deleteAddress, CLOUD } from '../lib/store';
import { getLock, setLock, clearLock } from '../lib/lock';
import { biometricAvailable, biometricConfirm, compressImage } from '../lib/proof';
import { reverseGeocode } from '../lib/geo';
import { APP_VERSION, BUSINESS_NAME } from '../lib/config';

/** Foto de perfil (Google) o inicial del nombre */
export function Avatar({ me, size = 36 }) {
  const [broken, setBroken] = useState(false);
  if (me?.photo && !broken)
    return <img src={me.photo} alt={me.name} width={size} height={size} className="avatar-img" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {(me?.name || '?')[0].toUpperCase()}
    </span>
  );
}

/** Selector de perfil activo (sin cerrar sesión) */
export function RoleSwitch({ me, go }) {
  const roles = allowedRoles(me);
  const cur = getViewRole(me);
  if (roles.length < 2) return null;
  const icon = { admin: '📊', driver: '🛵', client: '🙋' };
  return (
    <div className="seg role-switch">
      {roles.map((r) => (
        <button
          key={r}
          className={cur === r ? 'on' : ''}
          onClick={() => {
            setViewRole(me, r);
            go({ name: 'home' });
          }}
        >
          {icon[r]} {ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function ProfilePage({ me, go }) {
  const [name, setName] = useState(me.name || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [saved, setSaved] = useState(false);
  const save = () => {
    updateUser(me.id, { name: name.trim(), phone: phone.replace(/[^\d+]/g, '') });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return (
    <div className="page narrow">
      <div className="profile-head">
        <Avatar me={me} size={96} />
        <label className="btn ghost sm">
          📷 Cambiar foto
          <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files?.[0] && updateUser(me.id, { photo: await compressImage(e.target.files[0], 320, 0.8) })} />
        </label>
        <h2>{me.name}</h2>
        <div className="muted sm">{me.email || me.phone}</div>
        <span className="badge" style={{ '--c': '#1d4ed8' }}>
          {ROLE_LABEL[me.role]}
        </span>
      </div>

      <div className="card">
        <h3>Ver la app como</h3>
        <RoleSwitch me={me} go={go} />
        {allowedRoles(me).length < 2 && <p className="muted sm">Tu cuenta es de {ROLE_LABEL[me.role].toLowerCase()}.</p>}
      </div>

      <div className="card">
        <h3>Mis datos</h3>
        <div className="field">
          <label>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Celular / WhatsApp</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
        {me.email && (
          <div className="field">
            <label>Correo</label>
            <input value={me.email} disabled />
          </div>
        )}
        {me.role === 'driver' && (
          <p className="sm">
            🛵 {me.vehicle} · Placa <b>{me.plate || '—'}</b>
          </p>
        )}
        <button className="btn primary block" onClick={save}>
          {saved ? '✔ Guardado' : 'Guardar cambios'}
        </button>
      </div>

      <button className="btn ghost danger block" onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function LockSetup({ me, onDone }) {
  const cur = getLock(me.id);
  const [bio, setBio] = useState(false);
  const [mode, setMode] = useState(null); // 'pin' | 'pattern'
  const [first, setFirst] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    biometricAvailable().then(setBio);
  }, []);

  const finish = async (type, secret) => {
    await setLock(me.id, type, secret);
    setMode(null);
    setFirst(null);
    setMsg('✔ Bloqueo activado');
    onDone();
  };
  const step = (type) => async (v) => {
    if (type === 'pattern' && v.split('-').length < 4) return setMsg('Une al menos 4 puntos');
    if (!first) {
      setFirst(v);
      setMsg(type === 'pin' ? 'Repite el código' : 'Dibuja el patrón otra vez');
    } else if (first === v) finish(type, v);
    else {
      setFirst(null);
      setMsg('No coincide, empieza de nuevo');
    }
  };

  if (mode === 'pin')
    return (
      <div className="center">
        <p>{msg || 'Elige un código de 4 dígitos'}</p>
        <PinPad length={4} onDone={step('pin')} />
        <button className="btn ghost sm" onClick={() => (setMode(null), setFirst(null), setMsg(''))}>
          Cancelar
        </button>
      </div>
    );
  if (mode === 'pattern')
    return (
      <div className="center">
        <p>{msg || 'Dibuja tu patrón (mínimo 4 puntos)'}</p>
        <PatternPad onDone={step('pattern')} />
        <button className="btn ghost sm" onClick={() => (setMode(null), setFirst(null), setMsg(''))}>
          Cancelar
        </button>
      </div>
    );

  const type = cur?.type || 'none';
  const opt = (k, label, onClick, disabled) => (
    <button className={`lock-opt ${type === k ? 'on' : ''}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
  return (
    <div>
      <div className="lock-opts">
        {opt('none', '🔓 Sin bloqueo', () => (clearLock(me.id), setMsg('Bloqueo desactivado'), onDone()))}
        {opt('pin', '🔢 Código', () => (setMode('pin'), setMsg('')))}
        {opt('pattern', '✳️ Patrón', () => (setMode('pattern'), setMsg('')))}
        {opt(
          'bio',
          '👆 Huella / Face ID',
          async () => {
            try {
              await biometricConfirm(me, `activar-bloqueo|${Date.now()}`);
              finish('bio');
            } catch {
              setMsg('No se pudo verificar la huella');
            }
          },
          !bio
        )}
      </div>
      {!bio && <p className="muted sm">La huella / Face ID funciona en el enlace https (Netlify) y en teléfonos que la tengan configurada.</p>}
      {msg && <p className="sm">{msg}</p>}
      <p className="muted sm">El bloqueo se pide al abrir la app y al volver después de 1 minuto. Solo aplica en este celular.</p>
    </div>
  );
}

export function SettingsPage({ me, go }) {
  const [, refresh] = useState(0);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  const ds = me.driverStatus || 'none';
  return (
    <div className="page narrow">
      <h2>⚙️ Configuración</h2>

      <button className="card profile-row" onClick={() => go({ name: 'profile' })}>
        <span className="row gap">
          <Avatar me={me} size={40} />
          <b>{me.name}</b>
        </span>
        <span className="muted sm">Ver perfil ›</span>
      </button>

      {allowedRoles(me).length > 1 && (
        <div className="card">
          <h3>Cambiar de perfil</h3>
          <RoleSwitch me={me} go={go} />
        </div>
      )}

      <div className="card">
        <h3>🔒 Seguridad</h3>
        <p className="muted sm">Pide un código, patrón o huella para volver a entrar a la app.</p>
        <LockSetup me={me} onDone={() => refresh((x) => x + 1)} />
      </div>

      <div className="card">
        <h3>🔔 Notificaciones</h3>
        {perm === 'granted' ? (
          <p className="sm">✔ Activadas en este celular</p>
        ) : perm === 'denied' ? (
          <p className="sm muted">Bloqueadas: actívalas en los ajustes del navegador para este sitio.</p>
        ) : (
          <button className="btn" onClick={() => Notification.requestPermission().then(setPerm)}>
            Activar avisos
          </button>
        )}
      </div>

      {me.role !== 'admin' && (
        <div className="card">
          <h3>🛵 Trabajar como repartidor</h3>
          {me.role === 'driver' && me.approved ? (
            <p className="sm">✔ Eres repartidor aprobado.</p>
          ) : (
            <>
              <p className="sm">
                {ds === 'pending'
                  ? '⏳ Tu solicitud está en revisión.'
                  : ds === 'code_sent'
                    ? '🔑 Te aprobaron: ingresa tu código de ingreso.'
                    : ds === 'rejected'
                      ? `✖ Solicitud rechazada${me.driverRejectReason ? ': ' + me.driverRejectReason : ''}. Puedes enviarla de nuevo.`
                      : 'Llena tus datos y el administrador te dará un código de ingreso.'}
              </p>
              <button className="btn primary" onClick={() => go({ name: 'driver-apply' })}>
                {ds === 'code_sent' ? 'Ingresar código' : ds === 'pending' ? 'Ver solicitud' : 'Quiero ser repartidor'}
              </button>
            </>
          )}
        </div>
      )}

      <TariffCard forDriver={me.role !== 'client'} />

      <div className="card">
        <h3>ℹ️ Acerca de</h3>
        <p className="sm">
          {BUSINESS_NAME} · versión {APP_VERSION} · {CLOUD ? 'conectado a la nube' : 'modo demostración'}
        </p>
      </div>

      <button className="btn ghost danger block" onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const LABELS = ['🏠 Casa', '💼 Trabajo', '🏪 Tienda', '👪 Familia'];

export function AddressesPage({ me }) {
  const list = me.addresses || [];
  const [editing, setEditing] = useState(null);
  const blank = { label: '', address: '', lat: null, lng: null, reference: '' };
  const start = (a) => setEditing(a ? { ...a } : { ...blank });
  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }));

  if (editing)
    return (
      <div className="page narrow">
        <div className="page-head">
          <button className="btn ghost" onClick={() => setEditing(null)}>
            ← Volver
          </button>
          <h2>{editing.id ? 'Editar dirección' : 'Nueva dirección'}</h2>
        </div>
        <div className="card">
          <div className="chips">
            {LABELS.map((l) => (
              <button key={l} type="button" className={`chip ${editing.label === l.slice(3) ? 'on' : ''}`} onClick={() => set('label', l.slice(3))}>
                {l}
              </button>
            ))}
          </div>
          <div className="field">
            <label>Nombre</label>
            <input value={editing.label} onChange={(e) => set('label', e.target.value)} placeholder="Ej. Casa, Oficina, Tienda de mamá" />
          </div>
          <AddressInput label="Dirección" value={editing.lat ? editing : null} onChange={(p) => setEditing((e) => ({ ...e, ...p }))} />
          <MapView
            dropoff={editing.lat ? editing : null}
            height={240}
            onClick={async (p) => {
              const address = await reverseGeocode(p);
              setEditing((e) => ({ ...e, ...p, address }));
            }}
          />
          <p className="muted sm">Toca el mapa para marcar el punto exacto.</p>
          <div className="field">
            <label>Referencia</label>
            <input value={editing.reference} onChange={(e) => set('reference', e.target.value)} placeholder="Ej. portón negro, 2do piso" />
          </div>
          <button
            className="btn primary block lg"
            disabled={!editing.label.trim() || !editing.lat}
            onClick={async () => {
              await saveAddress(me, { ...editing, label: editing.label.trim() });
              setEditing(null);
            }}
          >
            Guardar dirección
          </button>
        </div>
      </div>
    );

  return (
    <div className="page narrow">
      <div className="row between">
        <h2>📍 Mis direcciones</h2>
        <button className="btn primary" onClick={() => start()}>
          + Agregar
        </button>
      </div>
      <p className="muted sm">Guarda tus lugares frecuentes y elígelos con un toque al pedir un envío.</p>
      {!list.length && <div className="card empty">Aún no tienes direcciones guardadas.</div>}
      <div className="list">
        {list.map((a) => (
          <div key={a.id} className="card addr-card">
            <div className="grow">
              <b>⭐ {a.label}</b>
              <div className="sm">{a.address}</div>
              {a.reference && <div className="muted sm">{a.reference}</div>}
            </div>
            <div className="col gap">
              <button className="btn ghost sm" onClick={() => start(a)}>
                Editar
              </button>
              <button className="btn ghost danger sm" onClick={() => confirm(`¿Borrar "${a.label}"?`) && deleteAddress(me, a.id)}>
                Borrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
