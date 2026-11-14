/**
 * Logo oficial de Envia2 Express (diseño del dueño, se usa tal cual).
 * Archivos en /public: logo.jpg (1024px), logo-original.webp (2000px) e íconos PNG.
 */
export function LogoMark({ size = 32 }) {
  // Siempre el logo completo (sin recortes), en el tamaño más cercano
  const src = size <= 64 ? './icon-64.png' : size <= 192 ? './icon-192.png' : './icon-512.png';
  return <img src={src} width={size} height={size} alt="Envia2 Express" style={{ display: 'block', borderRadius: size * 0.2 }} />;
}

/** Logo completo grande (pantalla de entrada, página del cliente) */
export function LogoFull({ size = 220 }) {
  return <img src="./logo.jpg" width={size} height={size} alt="Envia2 Express" className="logo-full" style={{ borderRadius: size * 0.08 }} />;
}

/** Ícono + nombre, para encabezados pequeños */
export default function Logo({ size = 32, light = false }) {
  return (
    <span className="logo-lockup" style={{ gap: size * 0.3 }} aria-label="Envia2 Express">
      <LogoMark size={size} />
      <span className="logo-text" style={{ fontSize: size * 0.56, color: light ? '#fff' : undefined }}>
        <span className="logo-name">
          Envia<b>2</b>
        </span>
        <small style={{ fontSize: size * 0.26 }}>express</small>
      </span>
    </span>
  );
}
