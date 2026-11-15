# Registro de versiones — Envia2 Express

**Versión de la app: 1.0.0** — se mantiene hasta que el dueño indique un cambio grande (la app aún no se lanza). Se ve al pie de la app.

**Entregas (ZIP):** desde la 4 se numeran con decimales: `envia2-express-v4.1.zip`, `-v4.2.zip`, `-v4.3.zip`… (antes fueron v1, v2, v3 y v4). Abajo se anota qué trae cada una.

---

## Entrega 4.1 (ZIP) — 15 nov 2026 · app versión 1.0.0 · ⚠️ reglas de Firebase actualizadas

**Tarifas y condiciones**
- Tarifario final (7 tramos; más de 7,5 km = Bs 25/30 + Bs 2,50 por km extra).
- Las 8 condiciones del servicio en la app y en el mensaje para WhatsApp Business.
- Mandados: el cliente **adelanta por QR** mínimo el 50 % de la compra (nunca menos que el envío); el saldo se cobra al entregar. El administrador sube su **QR de cobro** en el Panel.
- Valor declarado: más de Bs 500 se marca "cotizar aparte". Bultos de más de 10 kg: +Bs 3. El cliente acepta las restricciones antes de pedir.
- **No entrega**: el repartidor deja el paquete "En oficina" (Bs 3/día); el cliente puede pedir **reenvío** (+Bs 5).
- Aviso de reclamos en el momento de la entrega.
- Repartidor: ve su **ganancia** (precio − gasolina/desgaste por km, comisión opcional) y puede **ajustar el precio según la tabla** con los km de Google Maps. El cliente solo ve costos.

**Promociones** (menú 🎁, reemplaza a "Direcciones", que pasó a Configuración)
- 10 puntos por envío entregado; tarjeta de sellos: 6 envíos → cupón 50 %, 10 envíos → envío gratis.
- Ruleta (50 puntos): 10 %, 30 %, 50 %, +10/+20 puntos, 1 o 2 envíos gratis, o "sigue intentando".
- Cupones que se aplican al pedir (descuentan solo el envío); vencen a los 60 días.
- Panel de promociones para el administrador (giros, cupones usados, descuentos dados).

**Correcciones**
- La sesión ya no se pierde al cerrar la app (sesión guardada en el celular). Si aún se cierra cada hora: revisar la clave de API (guía).
- Mensajería: cada mensaje queda asociado al perfil que lo envió (se puede probar con una sola cuenta como cliente y repartidor).
- Repartidores nuevos llenan **toda la solicitud antes de iniciar sesión**; al confirmar identidad se envía sola.
- Pasos detallados para activar el ingreso con número de celular en Firebase.
- Reglas: el cliente ya no puede bajar el precio ni marcar su pedido como entregado; colecciones nuevas `settings` y `rewards`.

## Entrega v4 (ZIP) — 15 nov 2026 · app versión 1.0.0 · ⚠️ reglas de Firebase actualizadas

- **Menú inferior**: Inicio · Pedidos · Historial · Direcciones · Configuración (para cliente, repartidor y administrador).
- **Encabezado**: las letras "Envia2 express" del logo (sacadas de tu logo, fondo transparente, `public/wordmark.png`) sobre azul de la marca; a la derecha la **foto de Google** (o inicial) → abre el **Perfil**.
- **Cambiar de perfil sin cerrar sesión**: el administrador puede ver la app como Repartidor o Cliente (así también hace y entrega pedidos); un repartidor puede pasar a Cliente.
- **Entrada**: "Soy cliente" / "Soy repartidor"; con **Google** o **número de celular** (código por SMS de Firebase). Clientes: solo nombre y celular.
- **Repartidores con solicitud y código de ingreso**: foto, carnet (número + fotos), domicilio, vehículo (marca, color, placa, foto), licencia, 2 números de confianza → el administrador revisa, aprueba y genera un **código de 6 dígitos** (se envía por WhatsApp) → el repartidor lo ingresa y se activa. También se puede rechazar con motivo y bloquear/desbloquear.
- **Seguridad opcional**: bloqueo con código, patrón o huella/Face ID al abrir la app o al volver después de 1 minuto.
- **Direcciones guardadas** (Casa, Trabajo…) que aparecen como atajos ⭐ al pedir.
- **Perfil**: cambiar foto, nombre y celular.
- Reglas de Firebase nuevas (`firestore.rules`): el repartidor no puede aprobarse solo; sus documentos solo los ve el administrador; los códigos solo el administrador.

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
