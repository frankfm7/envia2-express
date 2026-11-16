import { useState } from 'react';
import { localLogin, loginGoogle, loginEmail, registerEmail, resetPassword, loginGuest, saveProfile, logout, takePendingAlias, cleanAlias, CLOUD } from '../lib/store';
import { APP_VERSION, BUSINESS_NAME } from '../lib/config';
import AnimatedLogo from '../components/AnimatedLogo';
import { ApplyForm, loadDraft, clearDraft } from './DriverApply';

export const ADMIN_CODE = import.meta.env.VITE_DEMO_ADMIN_CODE || '2468'; // solo modo demo
export const INTENT_KEY = 'envia2:intent'; // 'driver' si postuló como repartidor

const setIntent = (v) => {
  try {
    sessionStorage.setItem(INTENT_KEY, v);
  } catch {
    /* sin almacenamiento */
  }
};

/** ¿Se abrió dentro de WhatsApp / Facebook / Instagram? Ahí la sesión se borra y Google no deja entrar. */
const inAppBrowser = () => /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(navigator.userAgent || '');
const chromeIntent = () => `intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;

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
  if (c === 'auth/account-exists-with-different-credential') return 'Ese correo ya entró antes con Google. Usa "Continuar con Google".';
  if (c === 'auth/operation-not-allowed') return 'Ese método de ingreso no está activado en Firebase (ver la guía).';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found') return 'Correo o contraseña incorrectos.';
  if (c === 'auth/email-already-in-use') return 'Ese correo ya tiene una cuenta: usa "Ya tengo usuario".';
  if (c === 'auth/weak-password') return 'La contraseña debe tener al menos 6 caracteres.';
  if (c === 'auth/invalid-email') return 'Correo no válido.';
  return 'No se pudo entrar: ' + (c || e?.message);
};

/** Entrar con número de celular: SMS con código */

/** Usuario y contraseña: entrar, crear cuenta o recuperar — gratis */
function UserPass({ onBack }) {
  const [mode, setMode] = useState('login'); // login | register | reset
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      if (mode === 'login') await loginEmail(user, pass);
      else if (mode === 'register') {
        if (name.trim().length < 2) throw new Error('Escribe tu nombre');
        if (cleanAlias(alias).length < 3) throw new Error('Elige un usuario (alias) de al menos 3 letras, sin espacios');
        await registerEmail(email, pass, name.trim(), alias);
      } else {
        if (!user.includes('@')) throw new Error('Para recuperar la contraseña escribe tu CORREO. Si te registraste solo con usuario, pide ayuda a soporte.');
        await resetPassword(user);
        setMsg('📧 Te enviamos un correo para crear una nueva contraseña (revisa "Spam").');
      }
    } catch (e2) {
      setErr(e2.code ? (e2.code === 'auth/email-already-in-use' ? 'Ese usuario o correo ya existe: elige otro o entra con "Ya tengo cuenta".' : authError(e2)) : e2.message);
    }
    setBusy(false);
  };
  return (
    <form className="auth-panel" onSubmit={submit}>
      <h3>{mode === 'login' ? 'Entrar con mi usuario' : mode === 'register' ? 'Crear mi cuenta' : 'Recuperar contraseña'}</h3>
      {mode === 'register' && (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" aria-label="Nombre" />
          <input value={alias} onChange={(e) => setAlias(cleanAlias(e.target.value))} placeholder="Usuario / alias (ej. ana.flores)" autoComplete="username" aria-label="Alias" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo (opcional, para recuperar la contraseña)" autoComplete="email" aria-label="Correo" />
        </>
      )}
      {mode !== 'register' && (
        <input value={user} onChange={(e) => setUser(e.target.value)} placeholder={mode === 'reset' ? 'Tu correo' : 'Usuario (alias) o correo'} autoComplete="username" aria-label="Usuario" required />
      )}
      {mode !== 'reset' && <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contraseña (mínimo 6)" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-label="Contraseña" required minLength={6} />}
      <button className="btn primary" disabled={busy}>
        {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviarme el correo'}
      </button>
      {msg && <div className="alert success-box sm">{msg}</div>}
      {err && <div className="alert error sm">{err}</div>}
      <div className="row between wrap">
        {mode === 'login' ? (
          <>
            <button type="button" className="linkish" onClick={() => setMode('register')}>
              ¿No tienes cuenta? Crear una
            </button>
            <button type="button" className="linkish" onClick={() => setMode('reset')}>
              Olvidé mi contraseña
            </button>
          </>
        ) : (
          <button type="button" className="linkish" onClick={() => setMode('login')}>
            ← Ya tengo cuenta
          </button>
        )}
        <button type="button" className="linkish" onClick={onBack}>
          Cerrar
        </button>
      </div>
    </form>
  );
}

/** Datos mínimos la primera vez: nombre, alias y celular */
function ProfileForm({ initialName = '', initialPhone = '', initialAlias = '', onSubmit, submitLabel, children }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [alias, setAlias] = useState(initialAlias);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="auth-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim().length < 2) return setErr('Escribe tu nombre');
        if (phone.replace(/\D/g, '').length < 7) return setErr('Escribe tu celular (se usa para coordinar la entrega)');
        setBusy(true);
        try {
          await onSubmit({ name: name.trim(), phone, alias });
        } catch (e2) {
          setErr(e2.message);
          setBusy(false);
        }
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" aria-label="Nombre" />
      <input value={alias} onChange={(e) => setAlias(cleanAlias(e.target.value))} placeholder="Alias (cómo te saludamos, ej. ana)" aria-label="Alias" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Celular / WhatsApp (7 123 4567)" inputMode="tel" autoComplete="tel" aria-label="Celular" />
      {children}
      {err && <div className="alert error sm">{err}</div>}
      <button className="btn primary" disabled={busy}>
        {busy ? 'Un momento…' : submitLabel}
      </button>
    </form>
  );
}

/** Pantalla de ingreso (solo la primera vez o después de "Cerrar sesión") */
export default function Login({ session, claim }) {
  const [panel, setPanel] = useState(null); // 'user' | 'demo' | 'admin'
  const [stage, setStage] = useState(() => (loadDraft() ? 'confirm' : null)); // repartidor: 'form' | 'confirm'
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [adminCode, setAdminCode] = useState('');

  // Primera vez: completar perfil
  if (CLOUD && session?.needsProfile)
    return (
      <div className="auth">
        <div className="auth-inner">
          <AnimatedLogo size={150} />
          <h1>¡Bienvenido a {BUSINESS_NAME}!</h1>
          <p className="auth-sub">Completa tus datos una sola vez{session.email && !session.email.includes('usuarios.envia2') ? ` (${session.email})` : ''}.</p>
          <ProfileForm initialName={session.name || ''} initialPhone={(session.phone || '').replace(/^\+591/, '')} initialAlias={takePendingAlias() || ''} onSubmit={saveProfile} submitLabel={session.isAdminEmail ? 'Entrar como administrador' : 'Continuar'} />
          <button className="linkish" onClick={logout}>
            Usar otra cuenta
          </button>
        </div>
      </div>
    );

  // Repartidor nuevo: solicitud completa antes de iniciar sesión
  if (stage === 'form')
    return (
      <div className="login-apply">
        <ApplyForm
          me={null}
          go={() => {}}
          onBack={() => setStage(null)}
          onDraft={() => {
            setIntent('driver');
            setStage('confirm');
          }}
        />
      </div>
    );

  const run = async (fn) => {
    setErr('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(authError(e));
    }
    setBusy(false);
  };

  return (
    <div className="auth">
      <div className="auth-inner">
        <AnimatedLogo size={190} />
        <h1>{claim ? '¡Tu caja llegó!' : `Bienvenido a ${BUSINESS_NAME}`}</h1>
        <p className="auth-sub">{claim ? 'Entra para confirmar dónde y a qué hora te la entregamos.' : 'Envíos y mandados con rastreo en vivo.'}</p>

        {inAppBrowser() && (
          <div className="inapp-warn">
            ⚠️ Estás dentro de WhatsApp/Facebook: aquí tu sesión no se guarda y Google puede no dejarte entrar.{' '}
            {/Android/i.test(navigator.userAgent) ? <a href={chromeIntent()}>Abrir en Chrome</a> : 'Toca ••• y elige "Abrir en Safari".'}
          </div>
        )}
        {stage === 'confirm' && (
          <div className="alert success-box sm">
            ✅ <b>Tu solicitud de repartidor está lista.</b> Entra con Google o tu usuario para enviarla.
            <button className="linkish" onClick={() => (clearDraft(), setStage(null))}>
              Borrar solicitud
            </button>
          </div>
        )}

        {CLOUD ? (
          <>
            <button className="btn google" disabled={busy} onClick={() => run(loginGoogle)}>
              <GoogleLogo /> Continuar con Google
            </button>
            {panel === 'user' ? (
              <UserPass onBack={() => setPanel(null)} />
            ) : (
              <button className="btn userpass" onClick={() => setPanel('user')}>
                👤 Entrar con mi usuario
              </button>
            )}
            <div className="or">o</div>
            <button className="linkish" disabled={busy} onClick={() => run(loginGuest)}>
              Entrar como invitado (podrás completar tus datos después)
            </button>
          </>
        ) : panel === 'demo' || panel === 'admin' ? (
          <ProfileForm
            onSubmit={async ({ name, phone, alias }) => {
              if (panel === 'admin' && adminCode !== ADMIN_CODE) throw new Error('Código de administrador incorrecto');
              await localLogin({ name, phone, alias, role: panel === 'admin' ? 'admin' : 'client' });
            }}
            submitLabel="Entrar"
          >
            {panel === 'admin' && <input value={adminCode} onChange={(e) => setAdminCode(e.target.value)} type="password" inputMode="numeric" placeholder={`Código de administrador (demo: ${ADMIN_CODE})`} aria-label="Código de administrador" />}
          </ProfileForm>
        ) : (
          <>
            <div className="alert warn sm">Modo demostración: los datos quedan solo en este navegador.</div>
            <button className="btn google" onClick={() => setPanel('demo')}>
              👤 Entrar (demo)
            </button>
            <div className="or">o</div>
            <button className="linkish" onClick={() => run(loginGuest)}>
              Entrar como invitado
            </button>
          </>
        )}
        {err && <div className="alert error sm">{err}</div>}

        <div className="auth-foot">
          <button className="linkish" onClick={() => setStage('form')}>
            🛵 ¿Quieres ser repartidor? Postula aquí
          </button>
          {!CLOUD && panel !== 'admin' && (
            <button className="linkish" onClick={() => setPanel('admin')}>
              Administrador (demo)
            </button>
          )}
          <span>
            Al continuar aceptas las <a href="./privacidad.html" target="_blank" rel="noreferrer" className="linkish">políticas de privacidad</a> · versión {APP_VERSION}
          </span>
        </div>
      </div>
    </div>
  );
}
