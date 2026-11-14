# Registro de versiones — Envia2 Express

**Versión de la app: 1.0.0** — se mantiene hasta que el dueño indique un cambio grande (la app aún no se lanza). Se ve al pie de la app.

**Entregas (ZIP):** cada entrega lleva un número que crece (`envia2-express-v1.zip`, `-v2.zip`, `-v3.zip`…) solo para saber cuál es el más nuevo. Abajo se anota qué trae cada una.

---

## Entrega v3 (ZIP) — 14 nov 2026 · app versión 1.0.0

- **Íconos redondeados con el logo completo**: ya no se ve un cuadrado pequeño adentro ni difuminado. El fondo azul y las líneas de velocidad del propio logo se extienden hasta el borde, así el teléfono puede redondearlo o volverlo círculo sin cortar el repartidor, el texto "Envia" ni el "2".
  - Android: el logo ocupa el 74,5 % (lo máximo para que nada importante se corte en el círculo).
  - iPhone y computadora: el logo ocupa el 99 % con esquinas redondeadas.
- **Cotización del cliente con su propia medida**: pestaña "📏 Ya medí la distancia": el cliente escribe los km en **línea recta** (Google Maps "Medir distancia" o la app) y se suma **entre 40 % y 50 %** para estimar la distancia por las calles → precio estimado (con rango si cambia de tramo).
- Cotización tocando el mapa (A y B) también disponible para el cliente.
- Si el servicio de rutas no responde, la app estima con línea recta + 45 % (antes +35 %).
- El factor 40–50 % se cambia en `src/lib/tariff.js` (`STRAIGHT_TO_ROUTE`).

## Entrega v2 (ZIP) — 14 nov 2026 · app versión 1.0.0

- **Cotización para clientes** ("💲 ¿Cuánto me cuesta?"): el cliente marca origen y destino, ve la distancia **por la ruta** comparada con la línea recta, el **precio sugerido** y con "Aceptar y solicitar" pasa a la solicitud ya rellenada.
- **Íconos con el logo completo, sin recortes**: solo cambia de tamaño. iPhone (esquinas redondeadas) y Android (recorte en círculo) usan el logo entero dentro de un fondo azul igual a sus bordes.
- **Guía de lanzamiento nueva**: CMD → GitHub → **Netlify** → Firebase (se quitó Vercel). Archivo `netlify.toml` listo.
- Nota sobre Supabase en la guía (la app hoy usa Firebase).

## Entrega v1 (ZIP) — 14 nov 2026 · app versión 1.0.0

**Marca**
- Logo oficial del dueño aplicado tal cual (`public/logo-original.webp`, `public/logo.jpg`).
- Íconos de la app adaptados del logo: logo completo para el ícono del celular (Android/iPhone, 180–512 px) y recorte del repartidor para tamaños chicos (encabezado y pestaña: 32–96 px), `favicon.ico` y versión "maskable" para Android.

**Tarifario (Bolivia, Bs)**
- Tabla por distancia de **ruta por calles** (no línea recta): hasta 2,5 km · 2,6–4,0 km · 4,1–6,0 km · más de 6 km (+ Bs 2 o Bs 2,50 por km extra desde el km 6).
- Dos servicios: **Envío simple** y **Mandado con compra y espera**.
- Espera: 10 min gratis por parada; luego Bs 2 cada 10 min (medida automáticamente con el GPS, corregible).
- Recargo de Bs 3 desde las 21:00 o con lluvia/granizo (no se suman entre sí).
- Mandados: tope de Bs 100 adelantados; compras mayores, pago por QR antes.
- El cliente ve el precio calculado al pedir; el repartidor ve la tabla con **ganancia neta** como sugerencia.
- **Cotizador** para repartidor y administrador: pegar las ubicaciones que manda el cliente por WhatsApp → precio por ruta → enviar cotización por WhatsApp → crear la entrega.
- Corregir los km con la medición de Google Maps (botón "Ver ruta en Google Maps").
- Mensajes listos para WhatsApp Business: tarifario y condiciones del servicio.
- **Cobro final** al entregar: envío acordado + espera + clima + compra = total a cobrar, guardado en el comprobante.

**Funciones incluidas (resumen)**
- Cliente, repartidor y administrador; inicio con Google (Firebase) o modo demo.
- Rastreo en vivo, hora estimada de llegada, chat dentro de la app con paso a WhatsApp.
- Clientes sin la app: PIN + seguimiento + comprobante por WhatsApp (enlace público).
- PIN obligatorio (máx. 5 intentos), foto, firma en el celular del repartidor, GPS, sello digital, huella opcional.
- Funciona sin señal y sincroniza después; comprobantes por enviar cuando vuelve la señal.
- Cajas de catálogo (Yanbal, Ésika, L'Bel, Cyzone…) con confirmación de lugar y hora.
