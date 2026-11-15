import { useMemo, useRef, useState } from 'react';
import { useStore, saveReward } from '../lib/store';
import { PROMO, WHEEL, usePromo, pickPrize, spinRecord } from '../lib/promo';
import { fmtDate } from '../lib/geo';
import { money } from '../lib/config';

const SEG = 360 / WHEEL.length;

/** Ruleta en SVG */
function Wheel({ rotation, spinning }) {
  const R = 150;
  const C = 160;
  const arc = (i) => {
    const a0 = ((i * SEG - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180;
    return `M${C},${C} L${C + R * Math.cos(a0)},${C + R * Math.sin(a0)} A${R},${R} 0 0 1 ${C + R * Math.cos(a1)},${C + R * Math.sin(a1)} Z`;
  };
  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" aria-hidden="true" />
      <svg viewBox="0 0 320 320" className="wheel" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 5s cubic-bezier(.12,.72,.08,1)' : 'none' }}>
        <defs>
          <clipPath id="wheel-hub">
            <circle cx={C} cy={C} r="26" />
          </clipPath>
          <radialGradient id="wheel-shine" cx="50%" cy="35%" r="70%">
            <stop offset="0" stopColor="#fff" stopOpacity=".28" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R + 8} fill="#0b1f5c" />
        {WHEEL.map((w, i) => (
          <g key={w.key}>
            <path d={arc(i)} fill={w.color} stroke="#0b1f5c" strokeWidth="2" />
            <g transform={`rotate(${i * SEG + SEG / 2} ${C} ${C})`}>
              <text x={C} y={C - R * 0.62} fill={w.ink} textAnchor="middle" className="wheel-label" style={{ fontSize: Math.max(...w.label.split('\n').map((t) => t.length)) > 8 ? 12 : 15 }}>
                {w.label.split('\n').map((t, k, arr) => (
                  <tspan key={k} x={C} dy={k === 0 ? `${-(arr.length - 1) * 0.55}em` : '1.1em'}>
                    {t}
                  </tspan>
                ))}
              </text>
            </g>
          </g>
        ))}
        <circle cx={C} cy={C} r={R} fill="url(#wheel-shine)" />
        {/* luces del borde */}
        {Array.from({ length: 16 }, (_, i) => {
          const a = ((i * 22.5 - 90) * Math.PI) / 180;
          return <circle key={i} cx={C + (R + 4) * Math.cos(a)} cy={C + (R + 4) * Math.sin(a)} r="3.2" className={`bulb ${i % 2 ? 'b2' : ''}`} />;
        })}
        <circle cx={C} cy={C} r="34" fill="#0b1f5c" stroke="#f2c418" strokeWidth="4" />
        <image href="./icon-64.png" x={C - 26} y={C - 26} width="52" height="52" clipPath="url(#wheel-hub)" />
      </svg>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2.2 + Math.random() * 1.6,
        color: ['#f2c418', '#1d4ed8', '#ffffff', '#22c55e', '#f97316'][i % 5],
        rot: Math.random() * 360,
      })),
    []
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}

function Coupon({ c }) {
  return (
    <div className={`ticket ${c.pct === 100 ? 'gold' : ''}`}>
      <div className="ticket-left">
        <b>{c.pct === 100 ? 'GRATIS' : `${c.pct}%`}</b>
        <small>{c.pct === 100 ? 'envío' : 'de descuento'}</small>
      </div>
      <div className="ticket-right">
        <b>{c.label}</b>
        <span className="sm">{c.source}</span>
        <span className="muted sm">Vence el {new Date(c.expiresAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  );
}

/** Promociones del CLIENTE */
function ClientPromos({ me, go }) {
  const promo = usePromo(me);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const rotRef = useRef(0);

  const spin = async () => {
    if (spinning || !promo.canSpin) return;
    const idx = pickPrize();
    const target = 360 - (idx * SEG + SEG / 2);
    const cur = rotRef.current % 360;
    const next = rotRef.current + 360 * 6 + ((target - cur + 360) % 360);
    rotRef.current = next;
    setResult(null);
    setSpinning(true);
    setRotation(next);
    const rec = spinRecord(me, idx);
    setTimeout(async () => {
      await saveReward(rec);
      setSpinning(false);
      setResult({ ...WHEEL[idx], rec });
      navigator.vibrate?.(WHEEL[idx].key === 'none' ? 80 : [60, 40, 120]);
    }, 5100);
  };

  if (!promo) return null;
  const cyc = promo.stampsInCycle;
  return (
    <div className="page narrow promos">
      <div className="promo-hero">
        <div>
          <span className="promo-kicker">Tus puntos</span>
          <div className="promo-points">
            <span className="coin">★</span> {promo.points}
          </div>
          <span className="promo-sub">
            {promo.canSpin ? '¡Ya puedes girar la ruleta!' : `Te faltan ${PROMO.spinCost - promo.points} puntos para girar la ruleta`}
          </span>
        </div>
        <div className="promo-orders">
          <b>{promo.deliveredCount}</b>
          <span>envíos</span>
        </div>
      </div>

      <div className="card stamp-card">
        <div className="row between wrap gap">
          <h3>🎟️ Tarjeta de envíos</h3>
          <span className="muted sm">
            {promo.toNext === 1 ? '¡Te falta 1 envío' : `Te faltan ${promo.toNext} envíos`} para {promo.nextStamp.pct === 100 ? 'un envío GRATIS' : `tu cupón de ${promo.nextStamp.pct} %`}
            {promo.toNext === 1 ? '!' : ''}
          </span>
        </div>
        <div className="stamps">
          {Array.from({ length: PROMO.stampCycle }, (_, i) => {
            const n = i + 1;
            const gift = PROMO.stamps.find((s) => s.at === n);
            return (
              <div key={n} className={`stamp ${n <= cyc ? 'on' : ''} ${gift ? 'gift' : ''}`}>
                {n <= cyc ? '🛵' : gift ? (gift.pct === 100 ? '🎁' : '½') : n}
                {gift && <small>{gift.pct === 100 ? 'GRATIS' : `${gift.pct}%`}</small>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card wheel-card">
        <h3>🎡 Ruleta de premios</h3>
        <p className="muted sm">Cada giro cuesta {PROMO.spinCost} puntos. Puedes ganar hasta 2 envíos gratis.</p>
        <Wheel rotation={rotation} spinning={spinning} />
        <button className={`btn spin-btn block lg ${promo.canSpin ? '' : 'off'}`} onClick={spin} disabled={!promo.canSpin || spinning}>
          {spinning ? 'Girando…' : promo.canSpin ? `🎡 Girar (${PROMO.spinCost} puntos)` : `🔒 Necesitas ${PROMO.spinCost} puntos`}
        </button>
      </div>

      <div className="card">
        <h3>🎫 Mis cupones {promo.available.length ? `(${promo.available.length})` : ''}</h3>
        {!promo.available.length ? (
          <p className="muted sm">Aún no tienes cupones. Gánalos completando envíos o girando la ruleta.</p>
        ) : (
          <div className="tickets">
            {promo.available.map((c) => (
              <Coupon key={c.id} c={c} />
            ))}
          </div>
        )}
        {!!promo.available.length && (
          <button className="btn primary block" onClick={() => go({ name: 'new' })}>
            Usar en un nuevo envío
          </button>
        )}
      </div>

      <div className="card how">
        <h3>¿Cómo funciona?</h3>
        <ul>
          <li>
            ⭐ Ganas <b>{PROMO.pointsPerOrder} puntos</b> por cada envío entregado.
          </li>
          {PROMO.stamps.map((s) => (
            <li key={s.at}>
              🎟️ Al completar <b>{s.at} envíos</b> recibes un cupón de <b>{s.pct === 100 ? 'envío GRATIS' : `${s.pct} %`}</b>. La tarjeta se reinicia cada {PROMO.stampCycle} envíos.
            </li>
          ))}
          <li>
            🎡 Con {PROMO.spinCost} puntos giras la ruleta: descuentos de 10, 30 o 50 %, puntos extra, 1 o 2 envíos gratis.
          </li>
          <li>🎫 Los cupones se usan al pedir un envío (descuentan el costo del envío, no la compra) y vencen a los {PROMO.couponDays} días.</li>
        </ul>
      </div>

      {!!promo.spins.length && (
        <div className="card">
          <h3>Historial de la ruleta</h3>
          {promo.spins.slice(0, 10).map((r) => (
            <div key={r.id} className="row between sm spin-row">
              <span>{r.prize.label}</span>
              <span className="muted">{fmtDate(r.ts)}</span>
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className="prize-bg" onClick={() => setResult(null)}>
          {result.key !== 'none' && <Confetti />}
          <div className="prize" onClick={(e) => e.stopPropagation()}>
            <div className="prize-emoji">{result.key === 'none' ? '🍀' : result.free ? '🎁' : result.points ? '⭐' : '🎉'}</div>
            <h2>{result.key === 'none' ? '¡Casi!' : '¡Ganaste!'}</h2>
            <p className="prize-text">{result.label.replace('\n', ' ')}</p>
            <p className="muted sm">
              {result.key === 'none'
                ? 'Esta vez no salió premio. ¡Sigue juntando puntos!'
                : result.points
                  ? 'Los puntos ya se sumaron a tu cuenta.'
                  : 'Tu cupón ya está en "Mis cupones".'}
            </p>
            <button className="btn primary block lg" onClick={() => setResult(null)}>
              ¡Genial!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Promociones vistas por el ADMINISTRADOR / REPARTIDOR */
function StaffPromos({ me }) {
  const { shipments, rewards } = useStore();
  const withCoupon = shipments.filter((s) => s.coupon && s.status !== 'cancelled');
  const discountTotal = withCoupon.reduce((a, s) => a + (s.coupon.discount || 0), 0);
  const spins = (rewards || []).filter((r) => r.type === 'spin');
  const admin = me.role === 'admin';
  return (
    <div className="page narrow promos">
      <h2>🎁 Promociones</h2>
      <div className="card how">
        <h3>Programa de clientes</h3>
        <ul>
          <li>
            ⭐ {PROMO.pointsPerOrder} puntos por envío entregado · ruleta con {PROMO.spinCost} puntos.
          </li>
          <li>🎟️ Tarjeta de sellos: {PROMO.stamps.map((s) => `${s.at} envíos → ${s.pct === 100 ? 'envío gratis' : s.pct + ' %'}`).join(' · ')}.</li>
          <li>🎫 El cupón descuenta solo el costo del envío. Cobras al cliente el precio con descuento; tu ganancia se calcula sobre el precio completo (la diferencia la cubre la empresa).</li>
        </ul>
        <p className="muted sm">Premios y probabilidades: archivo <code>src/lib/promo.js</code>.</p>
      </div>
      {admin && (
        <>
          <div className="stats">
            <div className="stat">
              <span>Envíos con cupón</span>
              <b>{withCoupon.length}</b>
            </div>
            <div className="stat">
              <span>Descuentos dados</span>
              <b>{money(discountTotal)}</b>
            </div>
            <div className="stat">
              <span>Giros de ruleta</span>
              <b>{spins.length}</b>
            </div>
          </div>
          <div className="card">
            <h3>Probabilidades de la ruleta</h3>
            {WHEEL.map((w) => (
              <div key={w.key} className="row between sm spin-row">
                <span>{w.label.replace('\n', ' ')}</span>
                <b>{w.weight} %</b>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Últimos giros</h3>
            {!spins.length && <p className="muted sm">Aún no hay giros.</p>}
            {spins
              .slice()
              .reverse()
              .slice(0, 30)
              .map((r) => (
                <div key={r.id} className="row between sm spin-row">
                  <span>
                    <b>{r.userName}</b> · {r.prize.label}
                  </span>
                  <span className="muted">{fmtDate(r.ts)}</span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Promos({ me, go }) {
  return me.role === 'client' ? <ClientPromos me={me} go={go} /> : <StaffPromos me={me} />;
}
