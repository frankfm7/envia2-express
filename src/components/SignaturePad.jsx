import { useEffect, useRef, useState } from 'react';

/** Panel de firma con el dedo o el mouse. Devuelve un PNG (dataURL) en onChange. */
export default function SignaturePad({ onChange, height = 200 }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current;
    const setup = () => {
      const ratio = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      c.width = w * ratio;
      c.height = height * ratio;
      const ctx = c.getContext('2d');
      ctx.scale(ratio, ratio);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, height);
      ctx.strokeStyle = '#cbd5e1';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(20, height - 40);
      ctx.lineTo(w - 20, height - 40);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      setEmpty(true);
      onChange?.(null);
    };
    setup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  const point = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const p = point(e);
    const ctx = ref.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (!empty) onChange?.(ref.current.toDataURL('image/png'));
  };
  const clear = () => {
    const c = ref.current;
    const ctx = c.getContext('2d');
    const w = c.clientWidth;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(20, height - 40);
    ctx.lineTo(w - 20, height - 40);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#0f172a';
    setEmpty(true);
    onChange?.(null);
  };

  return (
    <div className="sigpad">
      <canvas
        ref={ref}
        style={{ height, touchAction: 'none' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        aria-label="Área de firma"
      />
      {empty && <div className="sigpad-hint">Firme aquí con el dedo ✍️</div>}
      <button type="button" className="btn ghost sm sigpad-clear" onClick={clear}>
        Borrar
      </button>
    </div>
  );
}
