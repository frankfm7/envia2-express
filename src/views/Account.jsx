import { useEffect, useState } from 'react';
import MapView from '../components/MapView';
import { AddressInput } from '../components/Common';
import { TariffCard } from '../components/Tariff';
import { PatternPad, PinPad } from '../components/AppLock';
import { updateUser, logout, allowedRoles, getViewRole, setViewRole, ROLE_LABEL, saveAddress, deleteAddress, CLOUD, cleanAlias, upgradeGuestGoogle } from '../lib/store';
import { getLock, setLockMethod, removeLockMethod, clearLock, lockMethods, METHOD_LABEL } from '../lib/lock';
import { biometricAvailable, biometricConfirm, compressImage } from '../lib/proof';
import { reverseGeocode } from '../lib/geo';
import { APP_VERSION, BUSINESS_NAME, whatsappLink } from '../lib/config';
import { getAppearance, setAppearance } from '../lib/appearance';
import { checkCode } from '../lib/offers';
import { CONDITIONS } from '../lib/tariff';
import { useSettings } from '../lib/store';
import { WhatsAppIcon } from '../components/Common';
import { loadDraft, submitDraftIfAny } from './DriverApply';

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
  const [alias, setAlias] = useState(me.alias || '');
  const [ci, setCi] = useState(me.ci || '');
  const [ciExt, setCiExt] = useState(me.ciExt || 'OR');
  const [home, setHome] = useState(me.home || null);
  const [homeRef, setHomeRef] = useState(me.homeRef || '');
  const [payPref, setPayPref] = useState(me.payPref || 'cash');
  const [saved, setSaved] = useState(false);
  const lockedName = me.role === 'driver' && me.approved; // nombre verificado del repartidor
  const save = () => {
    updateUser(me.id, {
      ...(!lockedName && { name: name.trim() }),
      phone: phone.replace(/[^\d+]/g, ''),
      alias: cleanAlias(alias) || null,
      ci: ci.replace(/\D/g, '') || null,
      ciExt,
      home: home ? { lat: home.lat, lng: home.lng, address: home.address } : null,
      homeRef: homeRef.trim(),
      payPref,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return (
    <div className="page narrow">
      <div className="profile-head">
        <Avatar me={me} size={96} />
        <label className="btn ghost sm">
          📷 Cambiar foto
          <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files?.[0] && updateUser(me.id, { photo: await compressImage(e.target.files[0], 320, 0.8, false) })} />
        </label>
        <h2>{me.name}</h2>
        {me.alias && <div className="muted">@{me.alias}</div>}
        {me.isGuest && <GuestUpgrade me={me} />}
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
        <p className="muted sm">Guarda tus datos una vez: se usan solos al pedir un envío.</p>
        <div className="field">
          <label>{lockedName ? '🔒 Nombre (verificado)' : 'Nombre completo'}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={lockedName} />
        </div>
        <div className="field">
          <label>Alias (cómo te saludamos)</label>
          <input value={alias} onChange={(e) => setAlias(cleanAlias(e.target.value))} placeholder="ej. ana" />
        </div>
        <div className="field">
          <label>Celular / WhatsApp</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
        <div className="row gap">
          <div className="field grow">
            <label>N° de carnet (CI)</label>
            <input value={ci} onChange={(e) => setCi(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="1234567" />
          </div>
          <div className="field" style={{ width: 90 }}>
            <label>Exp.</label>
            <select value={ciExt} onChange={(e) => setCiExt(e.target.value)}>
              {['OR', 'LP', 'CB', 'SC', 'PT', 'CH', 'TJ', 'BE', 'PD'].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <AddressInput label="Mi dirección (domicilio)" value={home} onChange={setHome} placeholder="Busca tu calle o pega tu ubicación" />
        <div className="field">
          <label>Referencia de la dirección</label>
          <input value={homeRef} onChange={(e) => setHomeRef(e.target.value)} placeholder="Ej. portón negro, frente a la farmacia, piso 2" />
        </div>
        <div className="field">
          <label>Forma de pago preferida</label>
          <select value={payPref} onChange={(e) => setPayPref(e.target.value)}>
            <option value="cash">Efectivo al repartidor</option>
            <option value="transfer">Transferencia / QR</option>
            <option value="card">Tarjeta</option>
          </select>
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
  const [bio, setBio] = useState(false);
  const [mode, setMode] = useState(null); // configurando 'pin' | 'pattern'
  const [first, setFirst] = useState(null);
  const [msg, setMsg] = useState('');
  const [, refresh] = useState(0);
  useEffect(() => {
    biometricAvailable().then(setBio);
  }, []);
  const methods = lockMethods(me.id);
  const enabled = methods.length > 0;
  const [wantOn, setWantOn] = useState(enabled);
  const changed = () => {
    refresh((x) => x + 1);
    onDone?.();
  };

  const step = (type) => async (v) => {
    if (type === 'pattern' && v.split('-').length < 4) return setMsg('Une al menos 4 puntos');
    if (!first) {
      setFirst(v);
      setMsg(type === 'pin' ? 'Repite el código' : 'Dibuja el patrón otra vez');
    } else if (first === v) {
      await setLockMethod(me.id, type, v);
      setMode(null);
      setFirst(null);
      setMsg(`✔ ${METHOD_LABEL[type]} activado`);
      changed();
    } else {
      setFirst(null);
      setMsg('No coincide, empieza de nuevo');
    }
  };

  if (mode)
    return (
      <div className="center">
        <p>{msg || (mode === 'pin' ? 'Elige un código de 4 dígitos' : 'Dibuja tu patrón (mínimo 4 puntos)')}</p>
        {mode === 'pin' ? <PinPad length={4} onDone={step('pin')} /> : <PatternPad onDone={step('pattern')} />}
        <button className="btn ghost sm" onClick={() => (setMode(null), setFirst(null), setMsg(''))}>
          Cancelar
        </button>
      </div>
    );

  const row = (k, icon, desc, onSet, available = true) => {
    const on = methods.includes(k);
    return (
      <div className={`lock-method ${on ? 'on' : ''}`}>
        <span className="lock-m-icon">{icon}</span>
        <span className="grow">
          <b>{METHOD_LABEL[k]}</b>
          <div className="muted sm">{available ? desc : 'Este celular o navegador no lo permite'}</div>
        </span>
        {on ? (
          <span className="row gap">
            {k !== 'bio' && (
              <button className="btn ghost sm" onClick={onSet}>
                Cambiar
              </button>
            )}
            <button className="btn ghost danger sm" onClick={() => (removeLockMethod(me.id, k), changed())}>
              Quitar
            </button>
          </span>
        ) : (
          <button className="btn sm primary" disabled={!available} onClick={onSet}>
            Activar
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="lock-setup">
      <label className="switch">
        <input
          type="checkbox"
          checked={enabled || wantOn}
          onChange={(e) => {
            if (e.target.checked) setWantOn(true);
            else {
              if (enabled && !confirm('¿Deshabilitar la seguridad de ingreso?')) return;
              clearLock(me.id);
              setWantOn(false);
              setMsg('Seguridad deshabilitada');
              changed();
            }
          }}
        />
        <span />
        <b>{enabled ? 'Habilitada' : wantOn ? 'Elige al menos un método' : 'Deshabilitada'}</b>
      </label>
      {(enabled || wantOn) && (
        <div className="lock-methods">
          <p className="muted sm">Puedes activar uno, dos o los tres. Al entrar podrás usar cualquiera.</p>
          {row('bio', '👆', 'Usa la huella, el rostro o el patrón/PIN que ya tiene tu celular', async () => {
            try {
              await biometricConfirm(me, `activar-bloqueo|${Date.now()}`);
              await setLockMethod(me.id, 'bio');
              setMsg('✔ Huella / bloqueo del celular activado');
              changed();
            } catch {
              setMsg('No se pudo verificar. Inténtalo otra vez.');
            }
          }, bio)}
          {row('pattern', '✳️', 'Dibuja un patrón de puntos', () => (setMode('pattern'), setMsg('')))}
          {row('pin', '🔢', 'Un código de 4 dígitos', () => (setMode('pin'), setMsg('')))}
        </div>
      )}
      {msg && <p className="sm">{msg}</p>}
      <p className="muted sm">Se pide al abrir la app y al volver después de 1 minuto. Solo aplica en este celular.</p>
    </div>
  );
}

/** Opción de Configuración: botón que muestra su contenido solo al tocarlo */
function Section({ id, icon, title, sub, open, setOpen, children, onClick, badge }) {
  const isOpen = open === id;
  return (
    <div className={`set-item ${isOpen ? 'open' : ''}`}>
      <button className="set-btn" onClick={() => (onClick ? onClick() : setOpen(isOpen ? null : id))} aria-expanded={isOpen}>
        <span className="set-icon">{icon}</span>
        <span className="set-text">
          <b>{title}</b>
          {sub && <small>{sub}</small>}
        </span>
        {badge && <span className="tag">{badge}</span>}
        <span className="set-chev">{onClick ? '›' : isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && !onClick && <div className="set-body">{children}</div>}
    </div>
  );
}

const DRIVER_REQS = [
  'Carnet de identidad vigente (fotos adelante y atrás)',
  'Una selfie con la cara visible',
  'Vehículo propio (moto, auto, camioneta o bicicleta) con foto donde se vea la placa',
  'Licencia de conducir (opcional, recomendada)',
  'Celular con internet y GPS',
  '2 números de confianza (familiar o amigo)',
];

/** Configuración → Trabajar como repartidor: requisitos, pasos y estado de la solicitud */
function DriverSection({ me, go, ds, P }) {
  const approved = me.role === 'driver' && me.approved;
  const [draft, setDraft] = useState(() => !approved && !['pending', 'code_sent'].includes(ds) && !!loadDraft());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const sendDraft = async () => {
    setBusy(true);
    setMsg('');
    try {
      await submitDraftIfAny(me);
      setDraft(false);
      setMsg('✅ Solicitud enviada al administrador.');
    } catch (e) {
      setMsg('✖ ' + (e.message || 'No se pudo enviar. Intenta de nuevo.'));
    }
    setBusy(false);
  };
  const step = { none: 1, rejected: 1, pending: 2, code_sent: 3 }[ds] || 1;
  const sub = approved ? 'Ver y actualizar' : draft ? 'Solicitud sin enviar' : ds === 'pending' ? 'Solicitud en revisión' : ds === 'code_sent' ? 'Ingresa tu código' : 'Requisitos y solicitud';
  return (
    <Section id="driver" icon="🛵" title={approved ? 'Mis datos de repartidor' : 'Trabajar como repartidor'} sub={sub} badge={draft ? 'Pendiente' : ds === 'code_sent' ? 'Código' : null} {...P}>
      {approved ? (
        <button className="btn" onClick={() => go({ name: 'driver-apply' })}>
          📝 Ver / actualizar mis datos
        </button>
      ) : (
        <>
          <ol className="driver-steps sm">
            {['Llena tus datos y requisitos', 'El administrador revisa tu solicitud', 'Recibes tu código de autorización', 'Escribes el código y quedas activo'].map((t, i) => (
              <li key={t} className={i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''}>
                {t}
              </li>
            ))}
          </ol>
          {(ds === 'none' || ds === 'rejected') && (
            <details className="sm">
              <summary>
                <b>Requisitos</b>
              </summary>
              <ul>
                {DRIVER_REQS.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </details>
          )}
          <p className="sm">
            {draft
              ? '📤 Llenaste tu solicitud pero todavía no llegó al administrador.'
              : ds === 'pending'
                ? '⏳ Tu solicitud está en revisión. Te avisaremos cuando tengas tu código.'
                : ds === 'code_sent'
                  ? '🔑 Te aprobaron: ingresa tu código de autorización.'
                  : ds === 'rejected'
                    ? `✖ Solicitud rechazada${me.driverRejectReason ? ': ' + me.driverRejectReason : ''}. Puedes corregir y enviarla de nuevo.`
                    : 'Llena tus datos y el administrador te dará un código de autorización.'}
          </p>
          {msg && <div className={`alert ${msg.startsWith('✅') ? 'success' : 'error'} sm`}>{msg}</div>}
          <div className="row gap wrap">
            {draft && (
              <button className="btn primary" disabled={busy} onClick={sendDraft}>
                {busy ? 'Enviando…' : '📤 Enviar ahora'}
              </button>
            )}
            <button className={`btn ${draft ? '' : 'primary'}`} onClick={() => go({ name: 'driver-apply' })}>
              {ds === 'code_sent' ? '🔑 Ingresar código' : ds === 'pending' ? 'Ver solicitud' : draft ? 'Revisar datos' : 'Llenar mi solicitud'}
            </button>
          </div>
        </>
      )}
    </Section>
  );
}

export function SettingsPage({ me, go, openId }) {
  const [, refresh] = useState(0);
  const [open, setOpen] = useState(openId || null);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  const ds = me.driverStatus || 'none';
  const lock = getLock(me.id);
  const P = { open, setOpen };
  return (
    <div className="page narrow">
      <h2>⚙️ Configuración</h2>

      <button className="card profile-row" onClick={() => go({ name: 'profile' })}>
        <span className="row gap">
          <Avatar me={me} size={44} />
          <span>
            <b>{me.name}</b>
            <div className="muted sm">{me.email || me.phone}</div>
          </span>
        </span>
        <span className="muted sm">Mi perfil ›</span>
      </button>

      <div className="set-list">
        <Section id="security" icon="🔒" title="Seguridad" sub={lock ? `Habilitada: ${Object.keys(lock.methods).map((m) => METHOD_LABEL[m].split(' ')[0].toLowerCase()).join(', ')}` : 'Deshabilitada · recomendado activarla'} badge={lock ? null : 'Recomendado'} {...P}>
          <p className="muted sm">Pide un código, patrón o huella al entrar a la app.</p>
          <LockSetup me={me} onDone={() => refresh((x) => x + 1)} />
        </Section>

        {me.role !== 'admin' && <DriverSection me={me} go={go} ds={ds} P={P} />}

        {allowedRoles(me).length > 1 && (
          <Section id="role" icon="🔁" title="Cambiar de perfil" sub="Cliente, repartidor o administrador" {...P}>
            <RoleSwitch me={me} go={go} />
          </Section>
        )}

        <Section id="addresses" icon="📍" title="Mis direcciones" sub={(me.addresses || []).length ? `${me.addresses.length} guardada(s)` : 'Casa, trabajo… para pedir con un toque'} onClick={() => go({ name: 'addresses' })} {...P} />

        <Section id="notif" icon="🔔" title="Notificaciones" sub={perm === 'granted' ? 'Activadas' : 'Desactivadas'} {...P}>
          {perm === 'granted' ? (
            <p className="sm">✔ Activadas en este celular</p>
          ) : perm === 'denied' ? (
            <p className="sm muted">Bloqueadas: actívalas en los ajustes del navegador para este sitio.</p>
          ) : (
            <button className="btn" onClick={() => Notification.requestPermission().then(setPerm)}>
              Activar avisos
            </button>
          )}
        </Section>

        <Section id="appearance" icon="🎨" title="Apariencia" sub="Tema claro u oscuro, tamaño de letra" {...P}>
          <AppearanceCard bare />
        </Section>

        {me.role === 'client' && (
          <Section id="promo" icon="🏷️" title="Código promocional" sub={me.promoCode ? `Guardado: ${me.promoCode}` : 'Canjea un código de descuento'} {...P}>
            <PromoCodeCard me={me} bare />
          </Section>
        )}

        <Section id="support" icon="💬" title="Asistencia" sub="Ayuda por WhatsApp o chat" {...P}>
          <SupportCard bare go={go} />
        </Section>

        <Section id="tariff" icon="💲" title="Tarifas" sub="Precios por distancia" {...P}>
          <TariffCard forDriver={me.role !== 'client'} open />
        </Section>

        <Section id="conditions" icon="📋" title="Condiciones del servicio" {...P}>
          <ol className="sm">
            {CONDITIONS.map(([t, d]) => (
              <li key={t} style={{ marginBottom: 6 }}>
                <b>{t}:</b> {d}
              </li>
            ))}
          </ol>
        </Section>

        <Section id="share" icon="📣" title="Recomendar la app" {...P}>
          <p className="muted sm">Comparte {BUSINESS_NAME} con tus amigos y familiares.</p>
          <button
            className="btn"
            onClick={() => {
              const url = location.origin + location.pathname;
              const text = `🛵 Te recomiendo ${BUSINESS_NAME}: envíos y mandados con rastreo en vivo. ${url}`;
              if (navigator.share) navigator.share({ title: BUSINESS_NAME, text, url }).catch(() => {});
              else window.open(whatsappLink('', text), '_blank');
            }}
          >
            📤 Compartir
          </button>
        </Section>

        <Section id="about" icon="ℹ️" title="Acerca de" sub={`Versión ${APP_VERSION}`} {...P}>
          <p className="sm">
            {BUSINESS_NAME} · versión {APP_VERSION} · {CLOUD ? 'conectado a la nube' : 'modo demostración'}
          </p>
          <a className="btn ghost sm" href="./privacidad.html" target="_blank" rel="noreferrer">
            Política de privacidad
          </a>
        </Section>

        <Section id="logout" icon="🚪" title="Cerrar sesión" onClick={logout} {...P} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const LABELS = ['🏠 Casa', '💼 Trabajo', '🏪 Tienda', '👪 Familia'];

export function AddressesPage({ me, go }) {
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
      <button className="btn ghost sm" onClick={() => go({ name: 'settings' })}>
        ← Configuración
      </button>
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

function AppearanceCard({ bare }) {
  const [a, setA] = useState(getAppearance);
  const upd = (p) => setA(setAppearance(p));
  return (
    <div className={bare ? '' : 'card'}>
      {!bare && <h3>🎨 Apariencia</h3>}
      <label className="sm muted">Tema</label>
      <div className="seg">
        {[
          ['auto', '⚙️ Automático'],
          ['light', '☀️ Claro'],
          ['dark', '🌙 Oscuro'],
        ].map(([k, l]) => (
          <button key={k} className={a.theme === k ? 'on' : ''} onClick={() => upd({ theme: k })}>
            {l}
          </button>
        ))}
      </div>
      <label className="sm muted">Tamaño de letra</label>
      <div className="seg">
        {[
          ['md', 'Normal'],
          ['lg', 'Grande'],
        ].map(([k, l]) => (
          <button key={k} className={a.font === k ? 'on' : ''} onClick={() => upd({ font: k })}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function PromoCodeCard({ me, bare }) {
  const settings = useSettings();
  const [code, setCode] = useState(me.promoCode || '');
  const [msg, setMsg] = useState('');
  if (me.role !== 'client') return null;
  return (
    <div className={bare ? '' : 'card'}>
      {!bare && <h3>🏷️ Código promocional</h3>}
      <p className="muted sm">Si tienes un código de descuento, guárdalo aquí y se aplicará en tu próximo pedido.</p>
      <div className="row gap">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ej. ORURO20" aria-label="Código promocional" />
        <button
          className="btn primary"
          onClick={() => {
            const o = checkCode(settings, code);
            if (!o) return setMsg('✖ Código no válido o vencido');
            updateUser(me.id, { promoCode: code.trim().toUpperCase() });
            setMsg(`✔ Código guardado: ${o.pct} % de descuento en tu próximo pedido`);
          }}
        >
          Canjear
        </button>
      </div>
      {msg && <p className="sm">{msg}</p>}
    </div>
  );
}

function SupportCard({ go }) {
  const settings = useSettings();
  return (
    <div>
      <p className="muted sm">¿Tienes un problema con un pedido o una duda? Escríbenos.</p>
      {go && (
        <button className="btn primary block" onClick={() => go({ name: 'messages', id: 'support' })}>
          💬 Chatear con soporte en la app
        </button>
      )}
      {settings.supportPhone && (
        <a className="btn wa block" style={{ marginTop: 8 }} href={whatsappLink(settings.supportPhone, `Hola ${BUSINESS_NAME}, necesito ayuda con la app.`)} target="_blank" rel="noreferrer">
          <WhatsAppIcon /> Escribir por WhatsApp
        </a>
      )}
    </div>
  );
}

/** Invitado: vincular con Google para no perder sus datos */
export function GuestUpgrade({ me, compact }) {
  const [err, setErr] = useState('');
  if (!me.isGuest || !CLOUD) return null;
  return (
    <div className={compact ? '' : 'alert info sm'} style={{ display: 'grid', gap: 6 }}>
      {!compact && <span>Entraste como invitado. Vincula tu cuenta con Google para no perder tus pedidos ni tus puntos.</span>}
      <button
        className="btn google"
        onClick={async () => {
          setErr('');
          try {
            await upgradeGuestGoogle(me);
          } catch (e) {
            setErr(e.code === 'auth/credential-already-in-use' ? 'Esa cuenta de Google ya está registrada: cierra sesión y entra con Google.' : 'No se pudo vincular: ' + (e.code || e.message));
          }
        }}
      >
        Continuar con Google
      </button>
      {err && <span className="sm warn">{err}</span>}
    </div>
  );
}

/** Antes del primer envío: datos completos (recomendado con Google) */
export function CompleteProfile({ me, go, onDone }) {
  const [name, setName] = useState(me.name === 'Invitado' ? '' : me.name || '');
  const [alias, setAlias] = useState(me.alias || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [err, setErr] = useState('');
  return (
    <div className="page narrow">
      <div className="card">
        <h2>📋 Completa tus datos</h2>
        <p className="muted">Para hacer un envío necesitamos tu nombre y celular: así el repartidor puede coordinar contigo.</p>
        {me.isGuest && CLOUD && (
          <>
            <p className="sm">
              <b>Recomendado:</b> vincula con Google y tus datos quedan guardados para siempre.
            </p>
            <GuestUpgrade me={me} compact />
            <div className="or">o llénalos aquí</div>
          </>
        )}
        <div className="field">
          <label>Nombre y apellido</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="field">
          <label>Alias (opcional)</label>
          <input value={alias} onChange={(e) => setAlias(cleanAlias(e.target.value))} placeholder="ej. ana" />
        </div>
        <div className="field">
          <label>Celular / WhatsApp</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="7 123 4567" autoComplete="tel" />
        </div>
        {err && <div className="alert error sm">{err}</div>}
        <button
          className="btn primary block lg"
          onClick={async () => {
            if (name.trim().length < 3) return setErr('Escribe tu nombre completo');
            if (phone.replace(/\D/g, '').length < 7) return setErr('Escribe tu celular');
            await updateUser(me.id, { name: name.trim(), alias: cleanAlias(alias) || null, phone: phone.replace(/[^\d+]/g, '') });
            onDone?.();
          }}
        >
          Guardar y continuar
        </button>
        <button className="btn ghost block" onClick={() => go({ name: 'home' })}>
          Ahora no
        </button>
      </div>
    </div>
  );
}
