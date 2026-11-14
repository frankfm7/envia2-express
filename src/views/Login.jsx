import { useState } from 'react';
import { localLogin, loginGoogle, saveProfile, logout, CLOUD } from '../lib/store';
import { BUSINESS_NAME, APP_VERSION } from '../lib/config';
import { LogoFull } from '../components/Logo';

const ROLES = [
  { id: 'client', icon: '🙋', title: 'Cliente / Consultora', desc: 'Recibo o envío cajas y sigo al repartidor' },
  { id: 'driver', icon: '🛵', title: 'Repartidor', desc: 'Entrego cajas y confirmo con firma' },
];

export const ADMIN_CODE = import.meta.env.VITE_DEMO_ADMIN_CODE || '2468'; // solo modo demo

function Hero({ claim }) {
  return (
    <div className="login-hero">
      <div className="hero-logo">
        <LogoFull size={260} />
      </div>
      {claim ? (
        <p>
          <b>¡Tu caja llegó!</b> Entra para confirmar dónde y a qué hora te la entregamos, o para firmar tu comprobante.
        </p>
      ) : (
        <p>Entregas de cajas con rastreo en vivo y comprobante firmado en el celular.</p>
      )}
      <ul className="hero-feats">
        <li>📍 Rastreo GPS y hora estimada de llegada</li>
        <li>✍️ Firma en el celular · 📸 Foto · 🔐 PIN · 👆 Huella</li>
        <li>📅 Eliges lugar y hora de entrega</li>
        <li>📶 Funciona sin señal y sincroniza después</li>
      </ul>
    </div>
  );
}

function ProfileForm({ initialName = '', roles, onSubmit, submitLabel, extra }) {
  const [role, setRole] = useState('client');
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('Moto');
  const [plate, setPlate] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (role === 'admin' && code !== ADMIN_CODE) return setErr('Código de administrador incorrecto');
    if (name.trim().length < 2) return setErr('Escribe tu nombre');
    if (phone.replace(/\D/g, '').length < 7) return setErr('Escribe tu celular (se usa para llamadas y WhatsApp)');
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), phone, role, vehicle: role === 'driver' ? vehicle : undefined, plate: role === 'driver' ? plate.toUpperCase() : undefined });
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      {roles.length > 1 && (
        <div className="role-grid" style={{ gridTemplateColumns: `repeat(${roles.length}, 1fr)` }}>
          {roles.map((r) => (
            <button type="button" key={r.id} className={`role ${role === r.id ? 'sel' : ''}`} onClick={() => setRole(r.id)}>
              <span className="role-icon">{r.icon}</span>
              <b>{r.title}</b>
              <span className="muted sm">{r.desc}</span>
            </button>
          ))}
        </div>
      )}
      <div className="field">
        <label>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" />
      </div>
      <div className="field">
        <label>Celular / WhatsApp</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7 123 4567" inputMode="tel" autoComplete="tel" />
      </div>
      {role === 'driver' && (
        <div className="row gap">
          <div className="field grow">
            <label>Vehículo</label>
            <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
              <option>Moto</option>
              <option>Auto</option>
              <option>Camioneta</option>
              <option>Mototaxi</option>
              <option>Bicicleta</option>
            </select>
          </div>
          <div className="field grow">
            <label>Placa</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC-123" />
          </div>
        </div>
      )}
      {role === 'admin' && (
        <div className="field">
          <label>Código de administrador</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} type="password" inputMode="numeric" placeholder="••••" />
          <span className="muted sm">Demo: {ADMIN_CODE}</span>
        </div>
      )}
      {extra}
      {err && <div className="alert error">{err}</div>}
      <button className="btn primary block lg" disabled={busy}>
        {busy ? 'Un momento…' : submitLabel}
      </button>
    </form>
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

/** Pantalla de entrada */
export default function Login({ session, claim }) {
  const [err, setErr] = useState('');

  // Modo nube: después de Google, completar perfil (celular y tipo de cuenta)
  if (CLOUD && session?.needsProfile)
    return (
      <div className="login">
        <Hero claim={claim} />
        <div className="card login-card">
          <h2>Completa tu perfil</h2>
          <p className="muted sm">Entraste como {session.email}.</p>
          {session.isAdminEmail ? (
            <ProfileForm initialName={session.name} roles={[{ id: 'client' }]} onSubmit={saveProfile} submitLabel="Entrar como administrador" />
          ) : (
            <ProfileForm initialName={session.name} roles={claim ? [ROLES[0]] : ROLES} onSubmit={saveProfile} submitLabel="Guardar y continuar" />
          )}
          <button className="btn ghost block" onClick={logout}>
            Usar otra cuenta
          </button>
        </div>
      </div>
    );

  return (
    <div className="login">
      <Hero claim={claim} />
      <div className="card login-card">
        <h2>Entrar</h2>
        {CLOUD ? (
          <>
            <button
              className="btn block lg google"
              onClick={async () => {
                setErr('');
                try {
                  await loginGoogle();
                } catch (e) {
                  setErr(navigator.onLine ? 'No se pudo entrar con Google: ' + (e.code || e.message) : 'Necesitas internet para entrar la primera vez. Después la app funciona sin señal.');
                }
              }}
            >
              <GoogleLogo /> Continuar con Google
            </button>
            {err && <div className="alert error">{err}</div>}
            <p className="muted sm center">Solo la primera vez necesitas internet. Después puedes trabajar sin señal y todo se sincroniza solo.</p>
          </>
        ) : (
          <>
            <div className="alert warn sm">
              <b>Modo demostración:</b> los datos se guardan solo en este navegador. Para usar Google y compartir datos entre celulares, sigue la guía <i>GUIA-PUBLICAR.md</i>.
            </div>
            <ProfileForm roles={[...ROLES, { id: 'admin', icon: '📊', title: 'Administrador', desc: 'Panel, cajas de catálogo y evidencias' }]} onSubmit={localLogin} submitLabel="Continuar" />
            <p className="muted sm center">Tip: abre dos pestañas — una como cliente y otra como repartidor — para ver el rastreo en vivo.</p>
          </>
        )}
        <div className="app-version">versión {APP_VERSION}</div>
      </div>
    </div>
  );
}
