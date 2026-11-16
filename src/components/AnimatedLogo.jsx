/** Logo COMPLETO con efecto de movimiento: la moto "avanza", líneas de velocidad y un brillo que pasa. */
export default function AnimatedLogo({ size = 220 }) {
  return (
    <div className="alogo" style={{ width: size, height: size }} aria-label="Envia2 Express">
      <div className="alogo-glow" />
      <div className="alogo-card">
        <img src="./logo.jpg" alt="Envia2 Express" className="alogo-img" />
        <span className="alogo-shine" />
      </div>
      <div className="alogo-lines" aria-hidden="true">
        <i style={{ top: '30%', animationDelay: '0s' }} />
        <i style={{ top: '46%', animationDelay: '.35s', width: '38%' }} />
        <i style={{ top: '62%', animationDelay: '.7s' }} />
        <i style={{ top: '76%', animationDelay: '.2s', width: '30%' }} />
      </div>
    </div>
  );
}

/** Saludo según la hora */
export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};
