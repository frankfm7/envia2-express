# Registro de versiones — Envia2 Express

**Versión de la app: 1.0.0** — se mantiene hasta que el dueño indique un cambio grande (la app aún no se lanza). Se ve al pie de la app.

**Entregas (ZIP):** desde la 4 se numeran con decimales: `envia2-express-v4.1.zip`, `-v4.2.zip`, `-v4.3.zip`… (antes fueron v1, v2, v3 y v4). Abajo se anota qué trae cada una.

---

## Entrega 4.13 (ZIP) — 16 nov 2026 · app versión 1.0.0 · sin cambios de reglas

**Entrega que no se cerraba — revisada con el emulador oficial de Firebase**
- Se probó la app REAL conectada a un Firestore de prueba con las reglas del proyecto: aceptar → esperar → recoger → llegar → esperar → entregar. Resultado: la entrega **queda guardada en la nube**, aparece en el **historial** del cliente y del repartidor y **suma los puntos** del cliente.
- Lo que sí se encontró y corrigió:
  - La ventana de entrega **tardaba hasta 8 s** esperando el GPS (parecía trabada). Ahora usa la última posición si es reciente, o espera como máximo 4 s; luego se cierra y abre el comprobante.
  - La app instalada podía seguir usando una **versión vieja** guardada en el celular. Ahora busca la versión nueva al abrir y al volver a la app, y se recarga sola al instalarla. El pie de la app muestra **"entrega 4.13"** para saber qué versión tiene cada celular.
- Nuevo en la pantalla del envío (repartidor): **"⏳ subiendo a la nube…"** o **"✅ Entrega guardada en la nube"**.
- Nuevo para el administrador: en el detalle de un envío trabado, **"🛠️ Cerrar como entregado (administrador)"**; queda registrado quién lo cerró y el comprobante lo indica.
- Si la nube rechaza la entrega por **permisos**, casi siempre es porque se entregó con la cuenta de **administrador** y su correo no está en `firestore.rules` (en la prueba, con un correo que no está en las reglas, la nube rechaza TODO).
- Interno (solo pruebas): `VITE_USE_EMULATOR=true` conecta la app al emulador de Firebase; no se usa en Netlify.

---

## Entrega 4.12 (ZIP) — 16 nov 2026 · app versión 1.0.0 · sin cambios de reglas

**La entrega SIEMPRE termina (con o sin internet)**
- Problema: la 4.11 esperaba la confirmación de la nube; con señal muy débil (0,09 kB/s) la foto no alcanzaba a subir y salía "la nube no confirmó a tiempo".
- Ahora la entrega se guarda en el celular y **termina al instante** (se abre el comprobante), con o sin señal. Sube sola cuando hay conexión: primero el estado "Entregado" (liviano) y después la foto y la firma.
- Fotos más livianas para subir rápido: la foto de entrega se reduce y la **firma pasa de PNG a JPG**.
- Si la nube **rechaza** la entrega, la pantalla del envío muestra el motivo y un botón **"🔄 Reintentar subir la entrega"** (lo guardado no se pierde).

**Notificaciones push**
- Corregido el error `messagingSenderId` (*missing-app-config-values*): la app lo toma sola del `VITE_FIREBASE_APP_ID` (no hay que agregar nada).

**Tiempo de espera visible para el cliente + cobrar o perdonar**
- El cliente ve en su seguimiento **"El repartidor está esperando"** con el **cronómetro**, el tiempo gratis que queda y, si se pasa, el **recargo**; tanto en el **recojo** como en la **entrega**. Debajo, el **total a pagar** (envío + espera).
- El repartidor tiene **"💰 Cobrar espera"** y **"🤝 Perdonar espera"** (también "No cobrar esta espera" antes de que se pase). Al perdonar, el cliente ve **"Espera condonada · pagas solo Bs X"** y recibe el aviso.
- El cobro final respeta lo elegido (muestra "condonada") y el comprobante lo registra.

---

## Entrega 4.11 (ZIP) — 16 nov 2026 · app versión 1.0.0 · sin cambios de reglas

**La entrega no terminaba (no se podía sacar el comprobante)**
- Causa probable: la nube rechazaba el guardado de "Entregado" y el error se perdía en silencio; la app mostraba "entregado" un momento y luego volvía atrás. Además, el aviso "Entregado" le llegaba al cliente igual (se enviaba antes de confirmar).
- Ahora, con internet, **la foto/firma y el estado "Entregado" esperan la confirmación de la nube**; si falla, el repartidor ve **el motivo exacto** (permisos, tamaño, señal) y puede reintentar. El aviso al cliente se envía **solo después** de confirmar. Sin señal sigue funcionando como antes (se sube al volver la conexión).
- Si la foto + firma + foto de recojo pasan el límite de 1 MB de la nube, la foto de entrega se achica sola. La copia pública del comprobante se envía sin la foto de recojo si es muy pesada.

**Avisos que aparecían cada vez que se entraba a la app**
- Causa: al abrir, los avisos viejos tardaban en cargar y la app los tomaba como nuevos (sonaban y salían como globos). Ahora solo suenan los avisos que llegan **después** de abrir la app; los anteriores quedan en la campana 🔔.

**"Sincronizando cambios…"**
- Ya no aparece: la sincronización es invisible. Solo se avisa si un cambio lleva más de 1 minuto sin poder subirse (y el aviso de "Sin señal" se mantiene).

**Mapa de seguimiento (repartidor en el envío, cliente, página pública, administrador)**
- El mapa queda **bloqueado** 🔒: al deslizar el dedo sobre el mapa **baja la pantalla** (ya no mueve el mapa). Sigue al repartidor con el GPS.
- Botones pequeños: **＋ / －** acercar o alejar (mantiene el acercamiento y sigue al repartidor), **🎯** volver a ver todo, **🔒/🔓** permitir mover el mapa con el dedo.

---

## Entrega 4.10 (ZIP) — 16 nov 2026 · app versión 1.0.0 · sin cambios de reglas · ⚙️ nueva configuración opcional (push)

**Tiempo de espera del repartidor**
- Ya **no empieza solo por GPS**. Al llegar a recoger, el repartidor toca **"⏳ Llegué · esperando el paquete"**; al llegar al destino, **"⏳ Esperando para entregar"**. Desde ese momento corre un **cronómetro** (10 min gratis; después muestra el cobro). Al cliente le llega el aviso de que lo están esperando.
- El cobro de espera al entregar usa esos tiempos (antes contaba desde que el GPS detectaba la llegada).
- **Simulación** oculta en el botón **⋮** de la tarjeta "Ubicación" (no se quitó). Si queda activada, se ve un aviso naranja para no olvidarla.

**Sesión que se cerraba sola**
- Si al abrir la app no cargaba el perfil, se mostraba la pantalla de Google aunque la sesión seguía abierta. Ahora muestra "no se pudo cargar tu cuenta" con **Reintentar**.
- Diagnóstico automático: si Firebase cierra la sesión, la pantalla de ingreso dice **"Tu sesión se cerró sola"** y el motivo; el administrador ve un aviso rojo si la **clave de API** no deja renovar la sesión (causa típica de "me saca cada hora").

**Notificaciones**
- Problema encontrado: en Android, Chrome **no permite** `new Notification()` → los avisos del sistema nunca aparecían. Ahora se muestran por el service worker, con vibración larga y quedan en pantalla (los importantes).
- **Tono tipo llamada** para avisos importantes (envío nuevo, cambios de tu pedido, solicitudes de repartidor): se repite hasta tocar la pantalla (máx. 30 s). Mensajes: pitido corto. Se elige en Configuración → Notificaciones (Llamada · Corto · Silencio) con botón **Probar tono**.
- **Notificaciones push con la app cerrada** (Firebase Cloud Messaging + función gratuita de Netlify `netlify/functions/push.mjs`): envío nuevo → repartidores conectados; cambios del pedido → cliente; soporte y solicitudes → administradores. Requiere 2 claves (guía: "🔔 Notificaciones push").
- Aviso amarillo arriba para activar las notificaciones en cada celular.

---

## Entrega 4.9 (ZIP) — 16 nov 2026 · app versión 1.0.0 · ⚠️ REGLAS ACTUALIZADAS (volver a pegar `firestore.rules`)

**Mensajería (soporte)**
- Problema: el chat de soporte decía "aún no está disponible" porque dependía de una lista de administradores "registrados" que estaba vacía.
- Ahora los mensajes de soporte van a un **buzón de administración** (`admins`): cualquier administrador los ve siempre, aunque no esté registrado. El administrador recibe el aviso en la campana y ve el contador de no leídos en Mensajes.
- `registerAdmin` espera a que carguen los ajustes antes de guardar (antes podía borrar los ajustes si se ejecutaba antes de tiempo).

**Regalos**
- El regalo ahora **espera la confirmación de la nube**; si la nube lo rechaza, el administrador ve el error (antes decía "✔ Regalo enviado" aunque no se hubiera guardado).
- El panel del administrador avisa si **Firebase no lo reconoce como administrador** (correo de las reglas distinto): esa es la causa más probable de que no lleguen los regalos ni se guarden los ajustes.

**Mi perfil (clientes y repartidores)**
- Nuevos datos: **carnet (CI) y expedido**, **mi dirección** (buscador / ubicación de WhatsApp), **referencia**, **forma de pago preferida**.
- Al pedir un envío ya vienen solos: el origen es tu dirección guardada, el pago es el preferido y la referencia va en las indicaciones. El carnet queda en el pedido (`clientCi`).

**Datos del repartidor**
- Datos **bloqueados 🔒** (los cambia solo el administrador): nombre, carnet, fecha de nacimiento, vehículo, placa, licencia y fotos. Botón "Pedir cambio al administrador" (llega a Soporte).
- Datos que puede actualizar: celular, domicilio, marca y color del vehículo, números de confianza.
- Reglas: el repartidor aprobado solo puede cambiar esos datos básicos en su solicitud, y en su perfil no puede cambiar nombre, placa ni vehículo.

---

## Entrega 4.8 (ZIP) — 16 nov 2026 · app versión 1.0.0 · sin cambios de reglas ni de datos

**Login con Google: Opción 3 de Firebase (proxy same-origin en Netlify)**
- Problema de la 4.7: con `authDomain` en firebaseapp.com, Chrome de Android (particionado de almacenamiento) volvía sin sesión → "Google no devolvió la sesión".
- Causa real del 404 de la 4.6 (`/__/auth/assets/...`): el **service worker** de la PWA respondía `/__/auth/handler` con la página de la app (`navigateFallback`), y esa página pedía sus archivos con ruta relativa → `/__/auth/assets/...` → 404.
- Ahora:
  - `authDomain: 'envia2-express.netlify.app'`.
  - **`public/_redirects`** nuevo: `/__/auth/*` (y `/__/firebase/*`) → `https://envia2-express.firebaseapp.com/...` con **200** (proxy), y después el fallback `/* /index.html 200`. El fallback se pasó de `netlify.toml` a este archivo para que el orden quede garantizado.
  - Service worker: `navigateFallbackDenylist: [/^\/__\//]` (ya no intercepta las direcciones de inicio de sesión).
  - Sin script propio ni `VITE_AUTH_PROXY`. Se mantiene `signInWithRedirect` + `getRedirectResult` + `onAuthStateChanged`.

---

## Entrega 4.7 (ZIP) — 16 nov 2026 · app versión 1.0.0 · sin cambios de reglas ni de datos

**Corrección urgente del login por redirección**
- Problema: en la 4.6 el `authDomain` apuntaba al dominio de Netlify (proxy). Al iniciar sesión, el navegador buscaba `/__/auth/assets/...` en Netlify → **404** y pantalla en blanco.
- Ahora el `authDomain` es fijo: **`envia2-express.firebaseapp.com`** (Firebase sirve ahí el `/__/auth/handler`).
- Se **eliminó el proxy**: borrado `scripts/auth-proxy.mjs`, el paso del build (`npm run build` = solo `vite build`), ya no se crea `_redirects` para `/__/auth`, y se quitó `VITE_AUTH_PROXY`.
- Se mantiene `signInWithRedirect` estándar del SDK (sin popups) y `getRedirectResult` al arrancar.

---

## Entrega 4.6 (ZIP) — 16 nov 2026 · app versión 1.0.0 · sin cambios de reglas ni de datos

**Inicio de sesión con Google por REDIRECCIÓN**
- Problema: el login usaba ventana emergente (popup). En celulares el navegador la bloquea y la pantalla quedaba **en blanco** al elegir la cuenta.
- Ahora **todas** las entradas con Google usan `signInWithRedirect` (y la de "invitado → completar con Google" usa `linkWithRedirect`). **No queda ningún `signInWithPopup` ni `linkWithPopup`** en el código.
- La app va a Google en la **misma pestaña** y al volver completa la sesión sola (`getRedirectResult` al arrancar + `onAuthStateChanged`). Al volver entra directo, sin pasar otra vez por la bienvenida.
- Si algo falla al volver, la pantalla de ingreso muestra el motivo (antes no decía nada).
- El proxy de inicio de sesión por el propio dominio (`/__/auth/…`) queda **activado por defecto** (la redirección lo necesita en Chrome/Safari modernos).
- Facebook: la app no tiene login con Facebook (se quitó en la 4.3); si se vuelve a poner, usará este mismo método.
- Reglas de Firestore y estructura de datos: **sin cambios**.

---

## Entrega 4.5 (ZIP) — 16 nov 2026 · app versión 1.0.0 · sin cambios de reglas

**Bienvenida**
- Vuelve la **foto del usuario** (la de Google si entró con Google; si no tiene foto, su inicial) junto al logo animado y el saludo.
- **Volver del segundo plano ya no lleva a la primera pantalla**: se quitó el re-bloqueo por tiempo. La bienvenida (con patrón/código/huella si están activos) aparece solo al **abrir la app de nuevo después de cerrarla**, y siempre entra a **Inicio**.

**Solicitud de repartidor (corrección)**
- Problema encontrado: el envío fallaba **en silencio** (las 5 fotos podían pasar el límite de 1 MB por documento de la nube, o la cuenta aún no estaba creada) y la app abría el formulario cada vez que se entraba porque el borrador seguía guardado.
- Ahora: las fotos se **achican automáticamente** hasta que la solicitud entre; el envío **espera la confirmación** de la nube y, si falla, muestra el motivo (sin internet, señal débil, permisos, fotos pesadas). El borrador solo se borra cuando llegó bien.
- Ya **no se abre el formulario solo** al entrar a la app.

**Configuración → Trabajar como repartidor**
- Ahora está arriba (después de Seguridad), con los **4 pasos** (llenar datos → revisión del administrador → código de autorización → activar), la lista de **requisitos**, el estado de la solicitud y el botón **📤 Enviar ahora** si quedó una solicitud sin enviar.

**Mensajes**
- El menú de abajo ya no se esconde ni se mueve: la conversación se desplaza **por dentro** de su recuadro (antes se movía toda la pantalla al llegar un mensaje); las respuestas rápidas se deslizan de lado y no ensanchan la pantalla.

---

## Entrega 4.4 (ZIP) — 16 nov 2026 · app versión 1.0.0 · sin cambios de reglas

**Ingreso**
- Pantalla de ingreso estilo app: **logo completo animado**, *Continuar con Google*, *Entrar con mi usuario* (**alias** o correo + contraseña, crear cuenta, recuperar), *Entrar como invitado*. Ya **no pregunta cliente o repartidor**: todos entran como cliente; "¿Quieres ser repartidor? Postula aquí" abajo.
- **Invitado**: puede mirar y cotizar; para **hacer un envío** debe completar nombre y celular (recomendado vincular con Google sin perder nada).
- **Alias** (nombre de usuario): en el registro, en el perfil y en los saludos.
- **Para que no pida Google otra vez**: inicio de sesión por el dominio propio (proxy `/__/auth`, variable `VITE_AUTH_PROXY`), el navegador guarda los datos de forma permanente, y aviso para abrir en Chrome si se entra desde WhatsApp/Facebook.

**Bienvenida (cada vez que se abre la app)**
- Logo completo con movimiento (la moto "avanza", líneas de velocidad y brillo), saludo según la hora: "Buenas tardes, ¡Bienvenido de nuevo, ana!".
- Sin seguridad: **toca en cualquier parte** para entrar. Con seguridad: pide el método configurado.

**Seguridad**
- **Un interruptor** Habilitada / Deshabilitada. Al habilitar se eligen **uno, dos o los tres** métodos: **huella / bloqueo del celular** (usa la huella, rostro, patrón o PIN que ya tiene el teléfono), **patrón** y **código**.
- Al entrar: patrón (o código) con botón **"Usar código" / "Usar patrón"**; si la huella está activa se ofrece sola y también hay botón "Usar huella".

## Entrega 4.3 (ZIP) — 16 nov 2026 · app versión 1.0.0 · ⚠️ reglas de Firebase actualizadas

**Entrada**
- Se quitó Facebook. Nuevo **"Entrar con mi usuario"** (correo y contraseña, gratis): ya tengo usuario, crear cuenta y recuperar contraseña.
- **No vuelve a pedir Google**: la app ya no muestra la pantalla de ingreso mientras carga la cuenta (era la causa de "me saca"). La sesión dura hasta "Cerrar sesión".
- La app **siempre abre en la pantalla de entrada** con el botón **Entrar**; si la persona activó seguridad (código, patrón o huella), se pide ahí.
- La primera vez se **recomienda activar la seguridad** ("Protege tu app").

**Menú y pantallas**
- Menú inferior: Inicio · Pedidos · **Mensajes** · Promociones · Configuración. **Historial** pasó dentro de Pedidos (pestañas En curso / Historial).
- **Configuración en botones**: cada opción se abre solo al tocarla (Seguridad, Cambiar de perfil, Direcciones, Notificaciones, Apariencia, Código promocional, Asistencia, Repartidor, Tarifas, Condiciones, Recomendar, Acerca de, Cerrar sesión).
- Encabezado: **ícono + letras del logo**.

**Mensajes**
- Chats de cada pedido y **chat directo**: el administrador escribe a cualquier repartidor o cliente; clientes y repartidores tienen **Soporte** con el administrador. Contador de no leídos en el menú, llamar y WhatsApp desde el chat.

**Avisos al administrador**
- **Solicitudes de repartidores nuevos**: aviso emergente y en la campana (no se pierde aunque llegue con la app cerrada); al tocarlo abre Repartidores. También avisa cuando un repartidor actualiza sus datos.

**Promociones (administrador)**
- **Regalar** a un cliente: cupón %, envíos gratis, **giros de ruleta** o puntos (con vencimiento y mensaje); al cliente le llega el aviso.
- **Configurar la ruleta**: nombre, color, tipo de premio, valor y **probabilidad** de cada casilla (deben sumar 100 %), con vista previa y botón para restaurar.

## Entrega 4.2 (ZIP) — 15 nov 2026 · app versión 1.0.0 · ⚠️ reglas de Firebase actualizadas

**Ingreso**
- **Continuar con Facebook** (gratis). Se ocultó el ingreso por SMS porque Firebase lo cobra (se puede reactivar con `VITE_PHONE_LOGIN=true`).
- Página de **política de privacidad** (`/privacidad.html`) que pide Meta para publicar el ingreso con Facebook.

**Inicio**
- **Avisos animados** tipo "historias" (barras de progreso, se deslizan solos o con el dedo): cómo pedir (cliente), cómo trabajar y recomendaciones (repartidor), atajos (administrador). Las **ofertas vigentes** salen primero.

**Administrador**
- **En línea ahora**: repartidores conectados, qué están haciendo y botón para llamar (en el Panel y en Repartidores).
- **Mejores repartidores del mes** con **🎉 Felicitar** (insignia en su perfil, aviso en la app y mensaje por WhatsApp).
- **Suspender** por días (con motivo), **bloquear**, **reactivar** y **eliminar** repartidores.
- **📈 Informes**: General (hoy, ayer, en curso y próximos), Diario (cualquier fecha pasada), Mensual, Trimestral y Anual, con comparación contra el período anterior, por repartidor y por servicio; imprimir/PDF, Excel y envío por WhatsApp.
- **🏷️ Ofertas**: primera entrega del día, primer pedido, todos los pedidos (por fechas, días y horas) y **códigos promocionales**; encender/apagar, uso y descuentos dados, anunciar por WhatsApp.
- **WhatsApp de asistencia** configurable.

**Repartidor**
- **Ver y actualizar sus datos** (fotos, carnet, vehículo, contactos) desde Configuración; el administrador ve "Actualizó sus datos".
- **Reenviar comprobante** desde el Historial; aviso cuando el cliente lo pide.
- Si está suspendido o bloqueado, ve el motivo y hasta cuándo.

**Cliente**
- Ofertas y **códigos promocionales** aplicados solos al pedir (un solo descuento: el mayor entre oferta y cupón).
- **Pedir mi comprobante** al repartidor (además de descargarlo).
- Configuración: **Apariencia** (claro / oscuro / automático, letra grande), **código promocional**, **asistencia por WhatsApp**, condiciones del servicio y **recomendar la app**.

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
