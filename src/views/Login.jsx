import { useState } from 'react';
import { localLogin, loginGoogle, loginPhoneStart, loginPhoneConfirm, saveProfile, logout, CLOUD } from '../lib/store';
import { APP_VERSION, WHATSAPP_COUNTRY_CODE } from '../lib/config';
import { LogoFull } from '../components/Logo';
import { ApplyForm, loadDraft, clearDraft } from './DriverApply';

export const ADMIN_CODE = import.meta.env.VITE_DEMO_ADMIN_CODE || '2468'; // solo modo demo
export const INTENT_KEY = 'envia2:intent'; // 'driver' si entró por "Soy repartidor"

const setIntent = (v) => {
  try {
    sessionStorage.setItem(INTENT_KEY, v);
  } catch {
    /* sin almacenamiento */
  }
};

function Hero({ claim }) {
  return (
    <div className="login-hero">
      <div className="hero-logo">
        <LogoFull size={240} />
      </div>
      {claim ? (
        <p>
          <b>¡Tu caja llegó!</b> Entra para confirmar dónde y a qué hora te la entregamos.
        </p>
      ) : (
        <p>Envíos y mandados con rastreo en vivo y comprobante firmado en el celular.</p>
      )}
    </div>
  );
}

const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const authError = (e) => {
  const c = e?.code || '';
  if (!navigator.onLine) return 'Necesitas internet para entrar la primera vez. Después la app funciona sin señal.';
  if (c === 'auth/invalid-phone-number') return 'Número no válido. Escribe tu celular de 8 dígitos.';
  if (c === 'auth/invalid-verification-code') return 'El código no es correcto.';
  if (c === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos.';
  if (c === 'auth/operation-not-allowed') return 'El ingreso por celular no está activado en Firebase (ver la guía).';
  if (c === 'auth/billing-not-enabled' || c === 'auth/quota-exceeded') return 'Firebase no puede enviar más SMS hoy (límite del plan). Entra con Google.';
  if (c === 'auth/unauthorized-domain') return 'Este dominio no está autorizado en Firebase (ver la guía).';
  return 'No se pudo entrar: ' + (c || e?.message);
};

/** Entrar con número de celular: SMS con código */
function PhoneLogin() {
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const e164 = () => {
    const d = phone.replace(/\D/g, '');
    return d.startsWith(WHATSAPP_COUNTRY_CODE) && d.length > 9 ? '+' + d : `+${WHATSAPP_COUNTRY_CODE}${d}`;
  };
  return (
    <div className="phone-login">
      {!sent ? (
        <>
          <div className="row gap">
            <span className="prefix">+{WHATSAPP_COUNTRY_CODE}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="7 123 4567" aria-label="Número de celular" />
          </div>
          <button
            id="phone-send"
            className="btn primary block lg"
            disabled={busy || phone.replace(/\D/g, '').length < 8}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await loginPhoneStart(e164(), 'phone-send');
                setSent(true);
              } catch (e) {
                setErr(authError(e));
              }
              setBusy(false);
            }}
          >
            {busy ? 'Enviando…' : '📱 Enviarme el código por SMS'}
          </button>
        </>
      ) : (
        <>
          <p className="sm">
            Escribe el código de 6 dígitos que llegó por SMS a <b>{e164()}</b>
          </p>
          <input className="pin-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="••••••" aria-label="Código SMS" />
          <button
            className="btn primary block lg"
            disabled={busy || code.length !== 6}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await loginPhoneConfirm(code);
              } catch (e) {
                setErr(authError(e));
                setBusy(false);
              }
            }}
          >
            {busy ? 'Verificando…' : 'Entrar'}
          </button>
          <button className="btn ghost sm" onClick={() => (setSent(false), setCode(''))}>
            Cambiar número
          </button>
        </>
      )}
      {err && <div className="alert error sm">{err}</div>}
    </div>
  );
}

/** Datos mínimos (solo la primera vez) */
function ProfileForm({ initialName = '', initialPhone = '', onSubmit, submitLabel, extra, children }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim().length < 2) return setErr('Escribe tu nombre');
        if (phone.replace(/\D/g, '').length < 7) return setErr('Escribe tu celular (se usa para llamadas y WhatsApp)');
        setBusy(true);
        try {
          await onSubmit({ name: name.trim(), phone });
        } catch (e2) {
          setErr(e2.message);
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" />
      </div>
      <div className="field">
        <label>Celular / WhatsApp</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7 123 4567" inputMode="tel" autoComplete="tel" />
      </div>
      {children}
      {extra}
      {err && <div className="alert error">{err}</div>}
      <button className="btn primary block lg" disabled={busy}>
        {busy ? 'Un momento…' : submitLabel}
      </button>
    </form>
  );
}

function WhoTabs({ who, setWho, demo }) {
  const tabs = [
    ['client', '🙋', 'Soy cliente'],
    ['driver', '🛵', 'Soy repartidor'],
    ...(demo ? [['admin', '📊', 'Administrador']] : []),
  ];
  return (
    <div className="role-grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map(([k, icon, label]) => (
        <button
          type="button"
          key={k}
          className={`role ${who === k ? 'sel' : ''}`}
          onClick={() => {
            setWho(k);
            setIntent(k === 'driver' ? 'driver' : '');
          }}
        >
          <span className="role-icon">{icon}</span>
          <b>{label}</b>
        </button>
      ))}
    </div>
  );
}

/** Pantalla de entrada */
export default function Login({ session, claim }) {
  const [who, setWho] = useState(() => (loadDraft() ? 'driver' : 'client'));
  const [method, setMethod] = useState(null); // 'phone'
  // Repartidor: 'choose' → 'form' (solicitud) → 'confirm' (entrar para enviarla) · 'code' (ya tiene código)
  const [stage, setStage] = useState(() => (loadDraft() ? 'confirm' : 'choose'));
  const [err, setErr] = useState('');
  const [adminCode, setAdminCode] = useState('');

  // Primera vez (nube): completar nombre y celular
  if (CLOUD && session?.needsProfile)
    return (
      <div className="login">
        <Hero claim={claim} />
        <div className="card login-card">
          <h2>¡Bienvenido!</h2>
          <p className="muted sm">Completa tus datos una sola vez{session.email ? ` (${session.email})` : ''}.</p>
          <ProfileForm initialName={session.name || ''} initialPhone={(session.phone || '').replace(/^\+591/, '')} onSubmit={saveProfile} submitLabel={session.isAdminEmail ? 'Entrar como administrador' : 'Continuar'} />
          <button className="btn ghost block" onClick={logout}>
            Usar otra cuenta
          </button>
        </div>
      </div>
    );

  // Repartidor nuevo: primero la solicitud completa (antes de iniciar sesión)
  if (who === 'driver' && stage === 'form')
    return (
      <div className="login-apply">
        <ApplyForm
          me={null}
          go={() => {}}
          onBack={() => setStage('choose')}
          onDraft={() => {
            setIntent('driver');
            setStage('confirm');
          }}
        />
      </div>
    );

  const driverChoose = (
    <div className="driver-choose">
      <div className="alert info sm">
        🛵 <b>Repartidores:</b> primero llenas tu solicitud (carnet, fotos, vehículo, números de confianza). El administrador la revisa y te da un <b>código de ingreso</b>.
      </div>
      <button className="btn primary block lg" onClick={() => setStage('form')}>
        📝 Soy nuevo: llenar mi solicitud
      </button>
      <button
        className="btn block lg"
        onClick={() => {
          setIntent('driver');
          setStage('code');
        }}
      >
        🔑 Ya envié mi solicitud / tengo mi código
      </button>
    </div>
  );
  const driverConfirm =
    stage === 'confirm' ? (
      <div className="alert success-box sm">
        ✅ <b>Tu solicitud está lista.</b> Último paso: confirma tu identidad para enviarla al administrador.
        <button
          className="btn ghost sm"
          onClick={() => {
            clearDraft();
            setStage('choose');
          }}
        >
          Borrar y empezar de nuevo
        </button>
      </div>
    ) : (
      <div className="alert info sm">🔑 Entra con la misma cuenta con la que enviaste tu solicitud. Si ya te dieron el código, podrás escribirlo.</div>
    );
  const showLogin = who !== 'driver' || stage === 'confirm' || stage === 'code';

  return (
    <div className="login">
      <Hero claim={claim} />
      <div className="card login-card">
        <h2>Entrar</h2>
        <WhoTabs who={who} setWho={setWho} demo={!CLOUD} />
        {who === 'driver' && stage === 'choose' && driverChoose}
        {who === 'driver' && stage !== 'choose' && driverConfirm}
        {!showLogin ? null : CLOUD ? (
          <>
            <button
              className="btn block lg google"
              onClick={async () => {
                setErr('');
                try {
                  await loginGoogle();
                } catch (e) {
                  setErr(authError(e));
                }
              }}
            >
              <GoogleLogo /> Continuar con Google
            </button>
            <div className="or">o</div>
            {method === 'phone' ? (
              <PhoneLogin />
            ) : (
              <button className="btn block lg" onClick={() => setMethod('phone')}>
                📱 Entrar con mi número de celular
              </button>
            )}
            {err && <div className="alert error">{err}</div>}
            <p className="muted sm center">Solo la primera vez necesitas internet. Después puedes trabajar sin señal.</p>
          </>
        ) : (
          <>
            <div className="alert warn sm">
              <b>Modo demostración:</b> los datos se guardan solo en este navegador. Para Google y celular, conecta Firebase (ver GUIA-PUBLICAR.md).
            </div>
            <ProfileForm
              onSubmit={async ({ name, phone }) => {
                if (who === 'admin' && adminCode !== ADMIN_CODE) throw new Error('Código de administrador incorrecto');
                await localLogin({ name, phone, role: who === 'admin' ? 'admin' : 'client' });
              }}
              submitLabel="Continuar"
            >
              {who === 'admin' && (
                <div className="field">
                  <label>Código de administrador</label>
                  <input value={adminCode} onChange={(e) => setAdminCode(e.target.value)} type="password" inputMode="numeric" placeholder="••••" />
                  <span className="muted sm">Demo: {ADMIN_CODE}</span>
                </div>
              )}
            </ProfileForm>
          </>
        )}
        <div className="app-version">versión {APP_VERSION}</div>
      </div>
    </div>
  );
}
