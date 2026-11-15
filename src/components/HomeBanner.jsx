import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../lib/store';
import { liveOffers, OFFER_TYPES } from '../lib/offers';
import { PROMO } from '../lib/promo';

const SLIDES = {
  client: [
    { icon: '📦', title: 'Pide en 3 pasos', text: '1) Marca dónde recogemos y dónde entregamos · 2) Elige envío simple o mandado · 3) Recibe con tu PIN.', cta: ['Hacer un pedido', 'new'], bg: 'b1' },
    { icon: '💲', title: '¿Cuánto me cuesta?', text: 'Cotiza antes de pedir: calculamos el precio por la ruta real, no en línea recta.', cta: ['Cotizar', 'quote'], bg: 'b2' },
    { icon: '🔐', title: 'Tu PIN es secreto', text: 'Dáselo solo al repartidor cuando recibas tu paquete. Revisa todo en ese momento: los reclamos se hacen al recibir.', bg: 'b3' },
    { icon: '🎁', title: `Gana envíos gratis`, text: `Cada envío suma ${PROMO.pointsPerOrder} puntos. Con 6 envíos ganas 50 % y con 10, un envío GRATIS. ¡Y gira la ruleta!`, cta: ['Ver promociones', 'promos'], bg: 'b4' },
    { icon: '🛍️', title: 'Mandados sin complicaciones', text: 'Compramos por ti: adelantas el 50 % por QR y el resto al recibir, con tu ticket.', bg: 'b1' },
  ],
  driver: [
    { icon: '🟢', title: 'Empieza tu turno', text: 'Activa "En línea" y usa el GPS real del teléfono para que los clientes te vean llegar.', bg: 'b1' },
    { icon: '📸', title: 'Al recoger', text: 'Revisa las cajas y toma la foto. En mandados no pongas tu dinero: compra con el adelanto confirmado.', bg: 'b2' },
    { icon: '✍️', title: 'Al entregar', text: 'Pide el PIN (obligatorio), toma la foto y haz firmar en tu celular. Funciona aunque no haya señal.', bg: 'b3' },
    { icon: '📤', title: 'Envía el comprobante', text: 'Desde "Comprobantes por enviar" mándalo por WhatsApp con un toque. Es tu respaldo.', bg: 'b4' },
    { icon: '⭐', title: 'Recomendaciones', text: 'Usa casco, cuida las cajas, saluda con amabilidad y avisa si te demoras. Los mejores repartidores reciben reconocimiento.', bg: 'b1' },
  ],
  admin: [
    { icon: '🛵', title: 'Repartidores', text: 'Revisa solicitudes, da códigos de ingreso, mira quién está en línea y felicita a los mejores.', bg: 'b1' },
    { icon: '🏷️', title: 'Lanza ofertas', text: 'Ej. "Primera entrega del día −30 %" o un código promocional. Se aplican solas al pedir.', bg: 'b2' },
    { icon: '📈', title: 'Informes', text: 'Diario, mensual, trimestral o anual, de cualquier fecha. Imprímelos o envíalos por WhatsApp.', bg: 'b3' },
    { icon: '💳', title: 'QR de cobro', text: 'Sube tu QR en el Panel para que los clientes paguen el adelanto de los mandados.', bg: 'b4' },
  ],
};

/** Avisos animados del inicio (tipo "historias") */
export default function HomeBanner({ role = 'client', go }) {
  const settings = useSettings();
  const offers = role === 'client' ? liveOffers(settings) : [];
  const slides = [
    ...offers.map((o) => ({
      icon: '🏷️',
      title: `${o.pct}% de descuento`,
      text: `${o.title || OFFER_TYPES[o.type]}${o.type === 'code' ? ` · usa el código ${o.code}` : ''}${o.endsAt ? ` · hasta el ${new Date(o.endsAt).toLocaleDateString('es')}` : ''}`,
      cta: ['Pedir ahora', 'new'],
      bg: 'offer',
    })),
    ...(SLIDES[role] || SLIDES.client),
  ];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);
  const n = slides.length;

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((x) => (x + 1) % n), 6000);
    return () => clearTimeout(t);
  }, [i, paused, n]);
  useEffect(() => setI(0), [n]);

  const s = slides[i % n];
  return (
    <div
      className={`home-banner ${s.bg}`}
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
        if (Math.abs(dx) > 40) setI((x) => (x + (dx < 0 ? 1 : n - 1)) % n);
      }}
      role="region"
      aria-label="Avisos"
    >
      <div className="hb-bars">
        {slides.map((_, k) => (
          <span key={k} onClick={() => setI(k)}>
            <i className={k < i ? 'full' : k === i ? (paused ? 'run paused' : 'run') : ''} key={k === i ? `run-${i}` : k} />
          </span>
        ))}
      </div>
      <div className="hb-body" key={i}>
        <div className="hb-icon">{s.icon}</div>
        <div className="hb-text">
          <b>{s.title}</b>
          <p>{s.text}</p>
          {s.cta && go && (
            <button className="hb-cta" onClick={() => go({ name: s.cta[1] })}>
              {s.cta[0]} →
            </button>
          )}
        </div>
      </div>
      <button className="hb-nav prev" aria-label="Anterior" onClick={() => setI((x) => (x + n - 1) % n)}>
        ‹
      </button>
      <button className="hb-nav next" aria-label="Siguiente" onClick={() => setI((x) => (x + 1) % n)}>
        ›
      </button>
    </div>
  );
}
