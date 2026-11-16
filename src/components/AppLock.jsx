import { useEffect, useRef, useState } from 'react';
import { getLock, checkSecret, unlockWithBiometric, markActive, clearLock, lockMethods, primaryMethod } from '../lib/lock';
import AnimatedLogo, { greeting } from './AnimatedLogo';
import { logout } from '../lib/store';
import { LogoMark } from './Logo';

/** Patrón 3×3 (como el de Android). Devuelve la secuencia, ej. "0-1-2-5-8". */
export function PatternPad({ onDone, size = 260, error }) {
  const ref = useRef(null);
  const [seq, setSeqState] = useState([]);
  const seqRef = useRef([]);
  const setSeq = (v) => {
    seqRef.current = typeof v === 'function' ? v(seqRef.current) : v;
    setSeqState(seqRef.current);
  };
  const [cursor, setCursor] = useState(null);
  const drawing = useRef(false);
  const cell = size / 3;
  const center = (i) => ({ x: (i % 3) * cell + cell / 2, y: Math.floor(i / 3) * cell + cell / 2 });

  const hit = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setCursor({ x, y });
    for (let i = 0; i < 9; i++) {
      const c = center(i);
      if (Math.hypot(c.x - x, c.y - y) < cell * 0.32) return i;
    }
    return null;
  };
  const add = (i) => i != null && setSeq((s) => (s.includes(i) ? s : [...s, i]));
  const down = (e) => {
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    setSeq([]);
    add(hit(e));
  };
  const move = (e) => drawing.current && add(hit(e));
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setCursor(null);
    if (seqRef.current.length) onDone(seqRef.current.join('-'));
    setTimeout(() => setSeq([]), 400);
  };

  const pts = seq.map(center);
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      className={`pattern ${error ? 'err' : ''}`}
      style={{ touchAction: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      aria-label="Dibuja tu patrón"
    >
      {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} className="pattern-line" />}
      {cursor && pts.length > 0 && <line x1={pts.at(-1).x} y1={pts.at(-1).y} x2={cursor.x} y2={cursor.y} className="pattern-line" />}
      {Array.from({ length: 9 }, (_, i) => {
        const c = center(i);
        const on = seq.includes(i);
        return (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={cell * 0.3} className="pattern-hit" />
            <circle cx={c.x} cy={c.y} r={on ? 14 : 9} className={on ? 'pattern-dot on' : 'pattern-dot'} />
          </g>
        );
      })}
    </svg>
  );
}

/** Teclado numérico para el código */
export function PinPad({ length = 4, onDone, error }) {
  const [v, setV] = useState('');
  useEffect(() => {
    if (v.length === length) {
      const val = v;
      setV('');
      onDone(val);
    }
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <div className="pinpad">
      <div className={`pin-dots ${error ? 'err' : ''}`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={i < v.length ? 'on' : ''} />
        ))}
      </div>
      <div className="pin-keys">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button key={i} type="button" onClick={() => setV((x) => (k === '⌫' ? x.slice(0, -1) : x.length < length ? x + k : x))}>
              {k}
            </button>
          )
        )}
      </div>
    </div>
  );
}

const ENTERED = 'envia2:entered';
const SUGGESTED = 'envia2:lock-suggested:';
const entered = () => {
  try {
    return sessionStorage.getItem(ENTERED) === '1';
  } catch {
    return false;
  }
};
function WelcomePhoto({ me }) {
  const [bad, setBad] = useState(false);
  if (me.photo && !bad) return <img className="lock-avatar" src={me.photo} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} />;
  return <div className="lock-avatar initial">{(displayName(me) || '?').charAt(0).toUpperCase()}</div>;
}
export const displayName = (me) => (me?.alias ? me.alias : (me?.name || '').split(' ')[0]);

/**
 * BIENVENIDA: la app siempre abre aquí (la sesión sigue guardada, no se pide Google).
 * • Sin seguridad: toca en cualquier parte para entrar.
 * • Con seguridad: patrón o código (con opción de cambiar) y huella si está activa.
 */
export default function AppLock({ me, children, onSecurity }) {
  const [locked, setLocked] = useState(() => !entered());
  const [method, setMethod] = useState(() => primaryMethod(me.id));
  const [error, setError] = useState(false);
  const [tries, setTries] = useState(0);
  const [suggest, setSuggest] = useState(() => {
    try {
      return entered() && !getLock(me.id) && !localStorage.getItem(SUGGESTED + me.id);
    } catch {
      return false;
    }
  });
  const methods = lockMethods(me.id);
  const secured = methods.length > 0;

  // Mientras la app está abierta NO se vuelve a pedir la bienvenida al volver del segundo plano.
  // La bienvenida (y el patrón/código/huella) se muestra solo cuando la app se abre de nuevo después de cerrarla.

  const ok = () => {
    try {
      sessionStorage.setItem(ENTERED, '1');
    } catch {
      /* sin almacenamiento */
    }
    markActive();
    setLocked(false);
    setTries(0);
    try {
      if (!getLock(me.id) && !localStorage.getItem(SUGGESTED + me.id)) setSuggest(true);
    } catch {
      /* sin almacenamiento */
    }
  };
  const fail = () => {
    setError(true);
    setTries((t) => t + 1);
    navigator.vibrate?.(200);
    setTimeout(() => setError(false), 600);
  };
  const tryBio = async () => {
    try {
      if (await unlockWithBiometric(me)) ok();
    } catch {
      /* canceló la huella: puede usar patrón o código */
    }
  };
  // Si tiene huella activa, se ofrece sola al abrir (también puede usar patrón/código)
  useEffect(() => {
    if (locked && methods.includes('bio')) tryBio();
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissSuggest = () => {
    try {
      localStorage.setItem(SUGGESTED + me.id, '1');
    } catch {
      /* sin almacenamiento */
    }
    setSuggest(false);
  };

  if (!locked)
    return (
      <>
        {children}
        {suggest && (
          <div className="prize-bg" onClick={dismissSuggest}>
            <div className="prize" onClick={(e) => e.stopPropagation()}>
              <div className="prize-emoji">🔒</div>
              <h2>Protege tu app</h2>
              <p className="muted">Te recomendamos activar tu huella, un patrón o un código para que nadie más entre a tu cuenta desde este celular.</p>
              <button
                className="btn primary block lg"
                onClick={() => {
                  dismissSuggest();
                  onSecurity?.();
                }}
              >
                Activar seguridad
              </button>
              <button className="btn ghost block" onClick={dismissSuggest}>
                Ahora no
              </button>
            </div>
          </div>
        )}
      </>
    );

  const other = method === 'pattern' && methods.includes('pin') ? 'pin' : method === 'pin' && methods.includes('pattern') ? 'pattern' : null;
  return (
    <div className={`lock-screen welcome ${secured ? '' : 'tap'}`} onClick={secured ? undefined : ok} role={secured ? undefined : 'button'} aria-label={secured ? undefined : 'Entrar'}>
      <AnimatedLogo size={secured ? 130 : 170} />
      <WelcomePhoto me={me} />
      <div className="welcome-text">
        <span className="welcome-kicker">{greeting()},</span>
        <h2>¡Bienvenido{me.gender === 'f' ? 'a' : ''} de nuevo, {displayName(me)}!</h2>
      </div>
      {!secured && (
        <>
          <button className="btn enter-btn lg" onClick={ok}>
            Entrar
          </button>
          <span className="tap-hint">o toca en cualquier parte de la pantalla</span>
        </>
      )}
      {secured && method === 'pin' && <PinPad length={4} error={error} onDone={async (v) => ((await checkSecret(me.id, 'pin', v)) ? ok() : fail())} />}
      {secured && method === 'pattern' && <PatternPad error={error} onDone={async (v) => ((await checkSecret(me.id, 'pattern', v)) ? ok() : fail())} />}
      {secured && method === 'bio' && <p className="muted">Usa tu huella, rostro o el bloqueo de tu celular.</p>}
      {secured && (
        <div className="row gap wrap" style={{ justifyContent: 'center' }}>
          {other && (
            <button className="btn ghost sm" onClick={() => setMethod(other)}>
              {other === 'pin' ? '🔢 Usar código' : '✳️ Usar patrón'}
            </button>
          )}
          {methods.includes('bio') && (
            <button className="btn ghost sm" onClick={tryBio}>
              👆 Usar huella
            </button>
          )}
        </div>
      )}
      {tries >= 3 && <div className="alert error sm">Intentos fallidos: {tries}</div>}
      <button
        className="btn ghost sm"
        onClick={(e) => {
          e.stopPropagation();
          if (secured && !confirm('Se cerrará la sesión y se quitará la seguridad de este celular. ¿Continuar?')) return;
          clearLock(me.id);
          logout();
        }}
      >
        {secured ? '¿Lo olvidaste? Cerrar sesión' : 'Usar otra cuenta'}
      </button>
    </div>
  );
}
