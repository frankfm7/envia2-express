import { useEffect, useRef, useState } from 'react';
import { getLock, checkSecret, unlockWithBiometric, markActive, lastActive, LOCK_AFTER_MS, clearLock } from '../lib/lock';
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

/**
 * Pantalla de bloqueo. Se muestra al abrir la app y al volver después de 1 minuto
 * en segundo plano, si el usuario activó un bloqueo en Configuración.
 */
export default function AppLock({ me, children }) {
  const cfg = getLock(me.id);
  const [locked, setLocked] = useState(() => !!cfg && Date.now() - lastActive() > LOCK_AFTER_MS);
  const [error, setError] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) markActive();
      else if (getLock(me.id) && Date.now() - lastActive() > LOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => !document.hidden && markActive(), 15000);
    markActive();
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(t);
    };
  }, [me.id]);

  const ok = () => {
    markActive();
    setLocked(false);
    setTries(0);
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
      fail();
    }
  };
  useEffect(() => {
    if (locked && cfg?.type === 'bio') tryBio();
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!locked || !cfg) return children;
  return (
    <div className="lock-screen">
      <LogoMark size={84} />
      <h2>Hola, {me.name?.split(' ')[0]}</h2>
      <p className="muted">
        {cfg.type === 'pin' ? 'Ingresa tu código' : cfg.type === 'pattern' ? 'Dibuja tu patrón' : 'Desbloquea con tu huella o Face ID'}
      </p>
      {cfg.type === 'pin' && <PinPad length={cfg.length || 4} error={error} onDone={async (v) => ((await checkSecret(me.id, v)) ? ok() : fail())} />}
      {cfg.type === 'pattern' && <PatternPad error={error} onDone={async (v) => ((await checkSecret(me.id, v)) ? ok() : fail())} />}
      {cfg.type === 'bio' && (
        <button className="btn primary lg" onClick={tryBio}>
          👆 Usar huella / Face ID
        </button>
      )}
      {tries >= 3 && <div className="alert error sm">Intentos fallidos: {tries}</div>}
      <button
        className="btn ghost sm"
        onClick={() => {
          if (!confirm('Se cerrará la sesión y se quitará el bloqueo de este celular. ¿Continuar?')) return;
          clearLock(me.id);
          logout();
        }}
      >
        ¿Lo olvidaste? Cerrar sesión
      </button>
    </div>
  );
}
