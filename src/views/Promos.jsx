import { useMemo, useRef, useState } from 'react';
import { useStore, saveReward, saveRewardStrict, useSettings, saveSettings, notifyUser } from '../lib/store';
import { PROMO, WHEEL, usePromo, pickPrize, spinRecord, getWheel, defaultWheelForEditor, PRIZE_TYPES, giftRecord } from '../lib/promo';
import { fmtDate } from '../lib/geo';
import { money } from '../lib/config';


/** Ruleta en SVG */
function Wheel({ rotation, spinning, wheel = WHEEL }) {
  const SEG = 360 / wheel.length;
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
        {wheel.map((w, i) => (
          <g key={w.key}>
            <path d={arc(i)} fill={w.color || ['#f2c418', '#1d4ed8', '#0b1f5c', '#ffffff'][i % 4]} stroke="#0b1f5c" strokeWidth="2" />
            <g transform={`rotate(${i * SEG + SEG / 2} ${C} ${C})`}>
              <text x={C} y={C - R * 0.62} fill={w.ink || '#0b1f5c'} textAnchor="middle" className="wheel-label" style={{ fontSize: Math.max(...String(w.label).split('\n').map((t) => t.length)) > 8 ? 12 : 15 }}>
                {String(w.label).split('\n').map((t, k, arr) => (
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
  const settings = useSettings();
  const wheel = getWheel(settings);
  const SEG = 360 / wheel.length;
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const rotRef = useRef(0);

  const spin = async () => {
    if (spinning || !promo.canSpin) return;
    const idx = pickPrize(wheel);
    const useFree = promo.freeSpins > 0;
    const target = 360 - (idx * SEG + SEG / 2);
    const cur = rotRef.current % 360;
    const next = rotRef.current + 360 * 6 + ((target - cur + 360) % 360);
    rotRef.current = next;
    setResult(null);
    setSpinning(true);
    setRotation(next);
    const rec = spinRecord(me, idx, wheel, useFree);
    setTimeout(async () => {
      await saveReward(rec);
      setSpinning(false);
      setResult({ ...wheel[idx], rec, key: wheel[idx].pct || wheel[idx].free || wheel[idx].points ? wheel[idx].key : 'none' });
      navigator.vibrate?.(wheel[idx].pct || wheel[idx].free || wheel[idx].points ? [60, 40, 120] : 80);
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
        {promo.freeSpins > 0 && <div className="alert success-box sm">🎁 Tienes {promo.freeSpins} giro(s) GRATIS de regalo</div>}
        <Wheel rotation={rotation} spinning={spinning} wheel={wheel} />
        <button className={`btn spin-btn block lg ${promo.canSpin ? '' : 'off'}`} onClick={spin} disabled={!promo.canSpin || spinning}>
          {spinning ? 'Girando…' : promo.freeSpins > 0 ? '🎁 Girar GRATIS' : promo.canSpin ? `🎡 Girar (${PROMO.spinCost} puntos)` : `🔒 Necesitas ${PROMO.spinCost} puntos`}
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
            <p className="prize-text">{String(result.label).replace('\n', ' ')}</p>
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
          <GiftPanel me={me} />
          <WheelEditor />
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

/** Administrador: editar nombres, premios y probabilidades de la ruleta */
function WheelEditor() {
  const settings = useSettings();
  const [rows, setRows] = useState(() => (Array.isArray(settings.wheel) && settings.wheel.length ? settings.wheel : defaultWheelForEditor()));
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const total = rows.reduce((a, r) => a + (Number(r.weight) || 0), 0);
  const set = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="card">
      <button className="set-btn" onClick={() => setOpen(!open)}>
        <span className="set-icon">🎡</span>
        <span className="set-text">
          <b>Configurar la ruleta</b>
          <small>Nombres, premios y probabilidad de cada casilla</small>
        </span>
        <span className="set-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="set-body">
          <div className="wheel-preview">
            <Wheel rotation={0} spinning={false} wheel={rows.map((r) => ({ ...r, key: r.label }))} />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="wheel-row">
              <input type="color" value={r.color || '#1d4ed8'} onChange={(e) => set(i, 'color', e.target.value)} aria-label="Color" />
              <input value={String(r.label).replace('\n', ' ')} onChange={(e) => set(i, 'label', e.target.value)} placeholder="Nombre" aria-label="Nombre de la casilla" />
              <select value={r.type} onChange={(e) => set(i, 'type', e.target.value)} aria-label="Tipo de premio">
                {Object.entries(PRIZE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              {r.type !== 'none' && <input type="number" min="1" value={r.value} onChange={(e) => set(i, 'value', e.target.value)} aria-label="Valor" className="mini" />}
              <span className="row gap">
                <input type="number" min="0" value={r.weight} onChange={(e) => set(i, 'weight', e.target.value)} aria-label="Probabilidad" className="mini" />%
              </span>
            </div>
          ))}
          <p className={`sm ${total === 100 ? 'ok-text' : 'warn'}`}>Suma de probabilidades: {total} % {total === 100 ? '✔' : '(debe sumar 100)'}</p>
          <div className="row gap wrap">
            <button
              className="btn primary"
              disabled={total !== 100}
              onClick={() => {
                saveSettings({ wheel: rows.map((r) => ({ ...r, ink: r.ink || (['#ffffff', '#f2c418', '#fde68a'].includes((r.color || '').toLowerCase()) ? '#0b1f5c' : '#ffffff') })) });
                setSaved(true);
                setTimeout(() => setSaved(false), 1500);
              }}
            >
              {saved ? '✔ Guardado' : 'Guardar ruleta'}
            </button>
            <button className="btn ghost" onClick={() => setRows(defaultWheelForEditor())}>
              Restaurar la de fábrica
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Administrador: regalar cupones, envíos gratis, giros o puntos a un cliente */
function GiftPanel({ me }) {
  const { users, rewards } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [client, setClient] = useState(null);
  const [kind, setKind] = useState('pct');
  const [value, setValue] = useState(30);
  const [days, setDays] = useState(30);
  const [note, setNote] = useState('');
  const [done, setDone] = useState('');
  const clients = users.filter((u) => u.role !== 'admin' && (!q || `${u.name} ${u.phone}`.toLowerCase().includes(q.toLowerCase())));
  const gifts = (rewards || []).filter((r) => r.type === 'gift').slice().reverse();
  const give = async () => {
    const opts = { days, note, ...(kind === 'pct' ? { pct: value } : kind === 'free' ? { free: value } : kind === 'spins' ? { spins: value } : { points: value }) };
    const rec = giftRecord(me, client, opts);
    setDone('Enviando…');
    try {
      await saveRewardStrict(rec); // espera la confirmación de la nube
    } catch (e) {
      setDone('✖ No se pudo enviar el regalo: ' + (e.message || 'error') + ' (revisa que tu correo esté en las reglas de Firebase como administrador).');
      return;
    }
    const what = kind === 'pct' ? `un cupón de ${value} % de descuento` : kind === 'free' ? `${value} envío(s) GRATIS` : kind === 'spins' ? `${value} giro(s) GRATIS en la ruleta` : `${value} puntos`;
    notifyUser(client.id, null, `🎁 ¡Tienes un regalo de Envia2 Express: ${what}! Míralo en Promociones.${note ? ' ' + note : ''}`);
    setDone(`✔ Regalo enviado a ${client.name}: ${what}`);
    setClient(null);
  };
  return (
    <div className="card">
      <button className="set-btn" onClick={() => setOpen(!open)}>
        <span className="set-icon">🎁</span>
        <span className="set-text">
          <b>Regalar a un cliente</b>
          <small>Cupones de descuento, envíos gratis, giros o puntos</small>
        </span>
        <span className="set-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="set-body">
          {!client ? (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente por nombre o celular" />
              <div className="thread-list" style={{ marginTop: 8, maxHeight: 260, overflow: 'auto' }}>
                {clients.slice(0, 40).map((u) => (
                  <button key={u.id} className="thread-row" onClick={() => setClient(u)}>
                    <span className="thread-text">
                      <b>{u.name}</b>
                      <small>
                        {u.phone} · {u.role === 'driver' ? 'Repartidor' : 'Cliente'}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="gift-form">
              <p>
                Para: <b>{client.name}</b>{' '}
                <button className="btn ghost sm" onClick={() => setClient(null)}>
                  Cambiar
                </button>
              </p>
              <div className="seg scroll-x">
                {[
                  ['pct', '🏷️ Cupón %'],
                  ['free', '🆓 Envío gratis'],
                  ['spins', '🎡 Giros'],
                  ['points', '⭐ Puntos'],
                ].map(([k, l]) => (
                  <button key={k} className={kind === k ? 'on' : ''} onClick={() => (setKind(k), setValue(k === 'pct' ? 30 : k === 'points' ? 50 : 1))}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="row gap wrap">
                <div className="field grow">
                  <label>{kind === 'pct' ? 'Descuento (%)' : kind === 'free' ? 'Cantidad de envíos gratis' : kind === 'spins' ? 'Cantidad de giros' : 'Puntos'}</label>
                  <input type="number" min="1" max={kind === 'pct' ? 100 : 999} value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
                {(kind === 'pct' || kind === 'free') && (
                  <div className="field grow">
                    <label>Vence en (días)</label>
                    <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} />
                  </div>
                )}
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mensaje (opcional): ¡Gracias por ser cliente frecuente!" />
              <button className="btn primary block lg" style={{ marginTop: 8 }} disabled={!Number(value)} onClick={give}>
                🎁 Regalar
              </button>
            </div>
          )}
          {done && <div className={`alert ${done.startsWith('✖') ? 'error' : 'success-box'} sm`}>{done}</div>}
          {!!gifts.length && (
            <>
              <h4>Regalos enviados</h4>
              {gifts.slice(0, 20).map((g) => (
                <div key={g.id} className="row between sm spin-row">
                  <span>
                    <b>{g.userName}</b> · {g.pct ? `${g.pct} %` : g.free ? `${g.free} envío(s) gratis` : g.spins ? `${g.spins} giro(s)` : `${g.points} pts`}
                  </span>
                  <span className="muted">{new Date(g.ts).toLocaleDateString('es')}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
