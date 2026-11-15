# 🛵 Envia2 Express — app versión 1.0.0 · entrega 4.2

Ver el historial de versiones en [CHANGELOG.md](CHANGELOG.md).

App web en **React** que funciona en **celular y computadora** (se puede instalar como app desde el navegador). Tiene tres modos: **Cliente**, **Repartidor** y **Administrador**.

## Cómo probarla

```bash
npm install
npm run dev
```

Abre la dirección que aparece (ej. `http://localhost:5173`).
**Truco:** abre dos pestañas: en una entra como *Cliente* y en otra como *Repartidor*. En el repartidor elige **Simulación (demo)** para ver la moto moverse sola por el mapa.

Para usarla en el celular dentro de tu red Wi-Fi: `npm run dev` muestra también una dirección `http://192.168.x.x:5173`. (Para GPS y huella el navegador exige **HTTPS**; ver "Publicar".)

## Funciones

| Cliente | Repartidor | Administrador |
|---|---|---|
| Cotización automática por distancia, tamaño de caja, cantidad y express | Botón En línea / Desconectado | Estadísticas del día e ingresos |
| Origen/destino buscando dirección, con GPS o tocando el mapa | Lista de envíos disponibles ordenados por cercanía | Mapa de repartidores en ruta |
| Envío inmediato o programado; efectivo, transferencia o tarjeta | Navegación con Google Maps y Waze | Buscador y filtros de todas las entregas |
| **Rastreo en vivo** del repartidor en el mapa | **GPS real** del teléfono o simulación | Comprobante de cada entrega con todas sus evidencias |
| **Hora estimada de llegada** (ETA) que se actualiza sola | Foto obligatoria al recoger la caja | Respaldo completo (JSON), Excel (CSV) y restauración |
| **PIN de 4 dígitos** para recibir | Llegada detectada automáticamente por GPS | Lista de repartidores con calificación |
| Mensajes y ubicación por WhatsApp | Entrega en 5 pasos: receptor → PIN → foto → firma → confirmación | |
| Llamar, WhatsApp y SMS al repartidor | Firma del repartidor con huella/Face ID | |
| Confirmar recepción con **huella / Face ID** (opcional) | Reportar incidencia (no se pudo entregar) | |
| Comprobante imprimible / PDF y calificación | Ganancias del día y efectivo a entregar | |

### Respaldo de cada entrega (prueba de entrega)
- ✍️ **Firma** de quien recibe, en el celular del repartidor
- 📸 **Foto** de la entrega (y otra al recoger) con fecha y hora impresas
- 🔐 **PIN obligatorio** que solo tiene el cliente (enviado por WhatsApp con advertencia de no compartirlo)
- 📍 **Ubicación GPS** y distancia al destino al momento de entregar
- 👆 **Huella / Face ID** (WebAuthn) del cliente y del repartidor
- 🛡️ **Sello digital SHA-256**: si alguien modifica la foto, la firma o los datos, el comprobante muestra "Evidencia alterada"

> Sobre la huella: por seguridad, ningún navegador ni app entrega la *imagen* de la huella. El teléfono verifica que es su dueño y devuelve una firma criptográfica, que es lo que se guarda. Por eso el cliente confirma con **su propio** teléfono.

## Configurar tu negocio
Edita `src/lib/config.js`: moneda, tarifas (`base`, `perKm`…), tamaños de caja, código de país para WhatsApp (o con variables de entorno, ver `.env.example`) y radio de entrega.
En modo nube, el administrador es el Gmail que pongas en `VITE_ADMIN_EMAILS`. En modo demo el código es `2468`.

## Tarifario final (Bs) — `src/lib/tariff.js`

| Distancia por la ruta | Envío simple | Mandado / encargo |
|---|---|---|
| Hasta 2 km | Bs 8 | Bs 10 |
| 2,1 – 3,5 km | Bs 10 | Bs 14 |
| 3,6 – 4,5 km | Bs 12 | Bs 18 |
| 4,6 – 5,5 km | Bs 15 | Bs 22 |
| 5,6 – 6,5 km | Bs 18 | Bs 25 |
| 6,6 – 7,5 km | Bs 22 | Bs 28 |
| Más de 7,5 km | Bs 25 + Bs 2,50/km extra | Bs 30 + Bs 2,50/km extra |

Las 8 condiciones del servicio están en el mismo archivo (`CONDITIONS`) y se muestran en la app.

## ¿Qué ve cada perfil?

| Información | Cliente | Repartidor | Administrador |
|---|:-:|:-:|:-:|
| Precio a pagar y su desglose | ✅ | ✅ | ✅ |
| Tabla de tarifas y condiciones | ✅ | ✅ | ✅ |
| **Ganancia** (precio − gasolina/desgaste − comisión) | ❌ | ✅ | ✅ |
| Ajustar el precio según la tabla (km de Google Maps) | ❌ | ✅ | ✅ |
| PIN de entrega | ✅ (solo el suyo) | ❌ (lo pide al cliente) | ❌ |
| Datos y documentos de repartidores | ❌ | Solo los suyos | ✅ |
| Códigos de ingreso de repartidores | ❌ | ❌ | ✅ |
| Promociones: puntos, cupones, ruleta | ✅ (los suyos) | Explicación | ✅ + estadísticas |
| Informes diarios / mensuales / anuales | ❌ | ❌ | ✅ |
| Crear ofertas y códigos | ❌ (los usa) | ❌ | ✅ |
| Suspender / bloquear / felicitar repartidores | ❌ | ❌ | ✅ |
| QR de cobro | ✅ (para pagar) | ✅ | ✅ (lo sube) |
| Todos los pedidos | Solo los suyos | Disponibles + los suyos | ✅ todos |

## Novedades v5
- 💬 **Mensajería dentro de la app** (solo texto, liviana) cuando el cliente usa la app, con botones **Ir a WhatsApp** y **Llamar**.
- 📵 Si el cliente **no** tiene la app, la comunicación es por **WhatsApp** (PIN, ubicación en tiempo real, mensajes rápidos).
- 📍 Seguimiento en la app: mapa en vivo, por dónde viene, hora estimada de llegada y etapas del envío.
- 🎨 **Logo oficial** (diseño del dueño, usado tal cual): `public/logo-original.webp` (2000 px), `public/logo.jpg` y los íconos PNG de la app.

## Novedades v4
- 💬 **WhatsApp para clientes sin la app**: enviar PIN + seguimiento, **ubicación en tiempo real** de WhatsApp (con guía de 3 toques), "mi ubicación ahora", mensajes rápidos y llamada.
- 🔐 **PIN obligatorio**: sin PIN correcto no se puede entregar (máx. 5 intentos). El PIN se envía por WhatsApp con la advertencia: *no compartirlo; si lo comparte, la empresa no se hace responsable por la pérdida del producto*. Se puede reenviar solo al número registrado del cliente.
- ℹ️ WhatsApp no permite funcionar *dentro* de otra app; cada botón abre el chat del cliente con el mensaje ya escrito.

## Novedades v3 — Envia2 Express
- 🛵 **El repartidor es la prioridad**: el cliente firma en el celular del repartidor (funciona sin señal) y esa es su constancia. La copia le llega al cliente después, cuando haya señal.
- 📤 **Comprobantes por enviar**: bandeja del repartidor; con un toque abre WhatsApp con el número del cliente y el enlace a su comprobante firmado. Aviso cuando vuelve la señal.
- 🔗 **Clientes sin la app**: enlace de **seguimiento en vivo** y **comprobante** que se abre en cualquier navegador, sin instalar ni iniciar sesión.
- ➕ **Nueva entrega desde el repartidor** (envío normal o caja de catálogo).
- 🎨 Nueva marca **Envia2 Express**.

## Novedades v2
- 🖼️ Comprobante en imagen para WhatsApp · 💄 Cajas de catálogo (Yanbal, Ésika, L'Bel, Cyzone…) con confirmación de lugar y hora · 📶 Funciona sin señal · 🔐 Google + Firebase gratis · ✅ Aprobación de repartidores.

## Publicar
Sigue **[GUIA-PUBLICAR.md](GUIA-PUBLICAR.md)**: CMD → GitHub → Netlify → Firebase, paso a paso.
Sin claves de Firebase la app arranca en **modo demo** (datos solo en el navegador).

## Servicios gratuitos usados
- Mapas: OpenStreetMap + Leaflet
- Rutas y tiempos: OSRM (si no responde, usa una ruta aproximada)
- Búsqueda de direcciones: Nominatim
Para mucho tráfico conviene cambiarlos por Google Maps / Mapbox (con API key).

## Estructura
```
src/
  lib/store.js        datos y tiempo real (elige nube o demo)
  lib/backend/        cloud.js (Firebase) y local.js (demo)
  lib/receiptImage.js comprobante como imagen para WhatsApp
  lib/geo.js          rutas, ETA, GPS, direcciones
  lib/proof.js        fotos, sello SHA-256, huella (WebAuthn)
  lib/config.js       tarifas y ajustes
  views/              Login, Cliente, Nuevo envío, Repartidor, Prueba de entrega,
                      Admin, Cajas de catálogo, Confirmar lugar y hora
  components/         Mapa, Firma, Chat, Comprobante…
```
