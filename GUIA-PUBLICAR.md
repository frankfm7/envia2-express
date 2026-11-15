# 🚀 Guía para lanzar Envia2 Express (gratis)

Orden recomendado:

```
1. Tu compu (CMD)  ──►  2. GitHub (guarda el código)  ──►  3. Netlify (publica la app con enlace https)
                                                                   │
                                     4. Base de datos (Firebase) ◄─┘  (opcional al inicio: sin ella funciona en modo demo)
```

> **Versión:** la app es la **versión 1.0.0** y se queda así hasta que se decida un cambio grande. Los ZIP que recibes se numeran aparte (`envia2-express-v4.1.zip`, `-v3`…) solo para saber cuál es el más nuevo. Ver `CHANGELOG.md`.

---

## PASO 0 · Instalar lo necesario (una sola vez)

1. **Node.js** (versión LTS): https://nodejs.org → descargar → instalar con "Siguiente".
2. **Git para Windows**: https://git-scm.com/download/win → instalar con las opciones por defecto.
3. Cierra y vuelve a abrir el **CMD** (tecla Windows → escribe `cmd` → Enter) y comprueba:

```bash
node -v
```
```bash
git --version
```

Si ambos muestran un número de versión, está listo.

4. Descomprime **envia2-express-v4.1.zip**, por ejemplo en el Escritorio. Queda la carpeta `envia2-express`.

---

## PASO 1 · Probar la app en tu compu

En el CMD entra a la carpeta (cambia `TU_USUARIO` por tu usuario de Windows):

```bash
cd C:\Users\TU_USUARIO\Desktop\envia2-express
```
```bash
npm install
```
```bash
npm run dev
```

Abre en el navegador `http://localhost:5173`. Para detenerla: `Ctrl + C` en el CMD.

> **Probar en el celular sin publicar:** con la compu y el celular en el mismo Wi-Fi, el CMD muestra una dirección tipo `http://192.168.x.x:5173`; ábrela en el celular. (El GPS y la cámara funcionan mejor con el enlace https de Netlify del paso 3.)

---

## PASO 2 · Subir el código a GitHub desde el CMD

### 2.1 Crear tu "campo" (repositorio) en GitHub
1. Entra a https://github.com y crea tu cuenta (o inicia sesión).
2. Arriba a la derecha **+ → New repository**.
3. *Repository name*: `envia2-express` · elige **Private** (nadie más ve tu código).
4. **No** marques "Add a README" ni ".gitignore" (la carpeta ya los trae) → **Create repository**.

### 2.2 Subir la carpeta (primera vez)
En el CMD, dentro de la carpeta de la app:

```bash
cd C:\Users\TU_USUARIO\Desktop\envia2-express
```
```bash
git config --global user.name "Tu Nombre"
```
```bash
git config --global user.email "tu_correo@gmail.com"
```
```bash
git init
```
```bash
git add .
```
```bash
git commit -m "Envia2 Express version 1"
```
```bash
git branch -M main
```
```bash
git remote add origin https://github.com/TU_USUARIO_GITHUB/envia2-express.git
```
```bash
git push -u origin main
```

La primera vez se abre una ventana para **iniciar sesión en GitHub** (autoriza en el navegador). Al terminar, recarga la página del repositorio: verás tus archivos.

> La carpeta `node_modules` no se sube (está en `.gitignore`), así debe ser.

### 2.3 Actualizar después (cada vez que recibas un ZIP nuevo)
1. Descomprime el ZIP nuevo y **copia su contenido encima** de tu carpeta `envia2-express` (reemplazar archivos). No borres la carpeta oculta `.git`.
2. En el CMD:

```bash
cd C:\Users\TU_USUARIO\Desktop\envia2-express
```
```bash
git add .
```
```bash
git commit -m "Actualizacion 4.1: tarifas finales, promociones, condiciones"
```
```bash
git push
```

Netlify publica la nueva versión sola en 1–2 minutos.

---

## PASO 3 · Publicar en Netlify (para probar en el celular)

### Opción A — Conectado a GitHub (recomendado: se actualiza solo con cada `git push`)
1. Entra a https://app.netlify.com → **Sign up** → **GitHub**.
2. **Add new site → Import an existing project → GitHub** → autoriza → elige `envia2-express`.
3. Netlify lee el archivo `netlify.toml` y completa todo solo:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **Deploy**. En 1–2 minutos te da un enlace tipo `https://algo-123.netlify.app`.
5. Cambia el nombre: *Site configuration → Change site name* → `envia2-express` → tu enlace queda `https://envia2-express.netlify.app` (si está libre).

### Opción B — Prueba rápida arrastrando (sin GitHub)
```bash
npm run build
```
Luego entra a https://app.netlify.com/drop y **arrastra la carpeta `dist`**. Te da un enlace al instante. (Cada cambio hay que volver a arrastrarlo; por eso es mejor la opción A.)

### Instalar en el celular
- **Android (Chrome):** abre tu enlace → menú ⋮ → **Instalar aplicación** / *Agregar a pantalla principal*.
- **iPhone (Safari):** abre tu enlace → botón Compartir → **Agregar a inicio**.

El ícono es tu logo **redondeado, llenando todo el ícono**: el fondo azul del logo se extiende hasta el borde, así el teléfono lo vuelve círculo o cuadrado redondeado **sin cortar** el repartidor, el texto ni el "2".

> **Sin base de datos (modo demo):** ya puedes probar todo en el celular, pero cada teléfono guarda sus propios datos. Para que cliente, repartidor y administrador se vean entre sí en celulares distintos, haz el Paso 4.

---

## PASO 4 · Base de datos e inicio con Google

La app **ya trae lista la conexión a Firebase** (Google): plan gratis sin tarjeta, inicio de sesión con Google y **funciona sin señal** (guarda en el celular y sube al volver internet).

> **¿Y Supabase?** Hoy la app no está conectada a Supabase. Se puede hacer, pero ten en cuenta que el plan gratis de Supabase **pausa el proyecto si pasa una semana sin uso**, ya te avisó por exceso de uso, y por sí solo **no guarda nada cuando no hay señal** (habría que programarlo aparte). Si de todas formas lo prefieres, avísame y preparo esa conexión en el siguiente ZIP.

### 4.1 Crear Firebase
1. https://console.firebase.google.com con tu Gmail → **Crear un proyecto** → nombre `envia2-express` → puedes desactivar Analytics → *Crear*.
2. Ícono **`</>`** (Web) → apodo `envia2-express` → *Registrar app*. Copia estos 4 valores de `firebaseConfig`:
   - `apiKey` → `VITE_FIREBASE_API_KEY`
   - `authDomain` → `VITE_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `VITE_FIREBASE_PROJECT_ID`
   - `appId` → `VITE_FIREBASE_APP_ID`
3. *Compilación → Authentication → Comenzar → Sign-in method → Google → Habilitar → Guardar*.
   - Para **entrar con número de celular** sigue la sección **"📱 Activar el ingreso con número de celular"** (más abajo).
4. *Compilación → Firestore Database → Crear base de datos* → ubicación `southamerica-east1` (São Paulo, la más cercana) → **modo producción**.
5. Firestore → pestaña **Reglas** → pega el contenido de `firestore.rules`, cambia `tu_correo@gmail.com` por **tu Gmail** → **Publicar**.
   > ⚠️ Cada vez que recibas un ZIP que diga "reglas actualizadas" en el CHANGELOG, vuelve a pegar y publicar `firestore.rules` (la 4 y la 4.1 las cambiaron).
6. *Authentication → Settings → Dominios autorizados* → **Agregar dominio** → `envia2-express.netlify.app` (tu dominio de Netlify, sin `https://`).

### 📱 Activar el ingreso con número de celular

Si en la app sale *"El ingreso por celular no está activado en Firebase"*, falta este paso:

1. Firebase → **Authentication** → pestaña **Sign-in method** (Método de acceso) → **Agregar proveedor nuevo** → **Teléfono** → activa el interruptor **Habilitar** → **Guardar**.
2. **Authentication → Settings** (Configuración) → **Política de regiones de SMS** → elige *Permitir* y agrega **Bolivia** → Guardar.
3. **Authentication → Settings → Dominios autorizados**: debe estar tu dominio de Netlify (ej. `envia2-express.netlify.app`).
4. **Probar gratis sin SMS reales:** en *Sign-in method → Teléfono → Números de teléfono para pruebas* agrega, por ejemplo, `+591 70000000` con el código `123456`. En la app escribe `70000000` y luego `123456`.
5. **SMS reales:** Firebase cobra los SMS. Si al pedir el código aparece un error de facturación o de cuota, en Firebase → ⚙️ → *Uso y facturación* cambia al plan **Blaze** (pago por uso) y pon una **alerta de presupuesto** baja (ej. USD 5) para no tener sorpresas. Revisa el precio por SMS a Bolivia en la página de precios de Firebase. Si no quieres pagar SMS, deja solo **Google**: la app funciona igual.

### 🔐 Si la app pide iniciar sesión otra vez cada hora

La app ya guarda la sesión en el celular. Si aun así se cierra a la hora, casi siempre es porque la **clave de API está restringida** y Firebase no puede renovar el acceso:

1. Entra a https://console.cloud.google.com → elige tu proyecto → **APIs y servicios → Credenciales**.
2. Abre la clave **"Browser key (auto created by Firebase)"**.
3. En *Restricciones de API*: deja **No restringir la clave**, o si la restringes, incluye **Identity Toolkit API** y **Token Service API**.
4. En *Restricciones de aplicaciones* (si usas "Sitios web"), agrega `https://envia2-express.netlify.app/*` y `https://TU-PROYECTO.firebaseapp.com/*`.
5. Guarda y espera 5 minutos.

### 4.2 Poner las claves en Netlify
Netlify → tu sitio → *Site configuration → Environment variables → Add a variable*:

| Nombre | Valor |
|---|---|
| `VITE_FIREBASE_API_KEY` | (de Firebase) |
| `VITE_FIREBASE_AUTH_DOMAIN` | (de Firebase) |
| `VITE_FIREBASE_PROJECT_ID` | (de Firebase) |
| `VITE_FIREBASE_APP_ID` | (de Firebase) |
| `VITE_ADMIN_EMAILS` | tu Gmail (el mismo de las reglas) |
| `VITE_BUSINESS_NAME` | `Envia2 Express` |
| `VITE_CURRENCY` | `Bs ` |
| `VITE_COUNTRY_CODE` | `591` |

Luego *Deploys → Trigger deploy → Deploy site* para que tome las claves.

> **Para probar en tu compu con Firebase:** copia `.env.example` como `.env`, rellena los valores y ejecuta `npm run dev`. El archivo `.env` no se sube a GitHub.

> **Plan gratis de Firebase:** 1 GB de datos, 50.000 lecturas y 20.000 escrituras al día. La ubicación del repartidor se envía cada 8 s (≈ 3.600 escrituras en 8 h): alcanza para varios repartidores.

---

## PASO 5 · Primer uso (con Firebase)

1. Abre tu enlace **con tu Gmail de administrador** → *Continuar con Google* → nombre y celular → entras como **Administrador**.
2. **Cambiar de perfil sin salir:** toca la etiqueta *Administrador* (arriba) o *Configuración → Cambiar de perfil* y elige **Repartidor** o **Cliente**. Como cliente puedes hacer tus propios pedidos; como repartidor, aceptarlos y entregarlos.
3. **Menú inferior:** 🏠 Inicio · 📦 Pedidos · 🕑 Historial · 📍 Direcciones · ⚙️ Configuración. Arriba a la derecha, tu **foto** abre tu perfil.
4. **Clientes:** entran con Google o su número de celular, y listo (solo nombre y celular la primera vez).
5. **Repartidores nuevos:**
   1. En la pantalla de entrada eligen **Soy repartidor → Soy nuevo: llenar mi solicitud** y llenan TODO **antes de iniciar sesión**: foto, carnet (número y fotos de los dos lados), domicilio, vehículo (marca, color, placa y foto), licencia opcional y **2 números de confianza**.
   2. Al final confirman su identidad con Google o celular y la solicitud te llega.
   3. Tú la ves en **Inicio → 🛵 Repartidores → Revisar** → **Aprobar y generar código** → **Enviar código por WhatsApp** (o se lo das en persona).
   4. El repartidor entra a *Configuración → Trabajar como repartidor → Ingresar código* y su cuenta se activa. Sin el código correcto no puede activarse (las reglas de Firebase lo verifican).
   5. Puedes **bloquear** o desbloquear a un repartidor en esa misma pestaña.
6. **Promociones (menú 🎁):** puntos por envío, tarjeta de sellos (6 envíos → 50 %, 10 envíos → gratis), cupones y ruleta. Premios y probabilidades en `src/lib/promo.js`.
7. **QR de cobro:** *Inicio → Panel → 💳 QR de cobro* → sube tu QR; los clientes lo ven al pagar el adelanto de los mandados.
8. **Seguridad (opcional, cada usuario):** *Configuración → Seguridad* → código de 4 dígitos, patrón o huella/Face ID. Se pide al abrir la app y al volver después de 1 minuto. Si alguien lo olvida, toca "¿Lo olvidaste? Cerrar sesión" y vuelve a entrar con Google o celular.
7. **Cajas de catálogo** (Yanbal, Ésika, L'Bel, Cyzone…): *Inicio → 💄 Catálogo* (igual que antes).
8. **Instalar en el celular:** Chrome → menú ⋮ → *Instalar aplicación* (iPhone: Safari → Compartir → *Agregar a inicio*).

---

## Sin señal: cómo funciona

- Después de entrar **una vez con internet**, la app abre aunque no haya señal.
- El repartidor puede: crear entregas, ver sus entregas, tomar fotos, pedir el PIN, **hacer firmar en su celular** y confirmar la entrega. Arriba verá *"📵 Sin señal — todo se guarda en el celular"*. Cuando vuelve la señal se sube solo (*"🔄 Sincronizando…"*).
- El **comprobante en imagen** se genera en el celular sin internet y se comparte por WhatsApp (WhatsApp lo envía cuando haya señal).
- Necesitan señal: que el cliente vea su enlace (se publica cuando vuelve la señal), **aceptar** un envío creado por otra persona (para que dos repartidores no tomen la misma caja) y que la consultora abra su enlace por primera vez.
- Mapas: se ven sin señal las zonas que ya se abrieron antes.

## Firma y comprobante: el repartidor primero
- El cliente **firma con el dedo en el celular del repartidor**. Es la constancia del repartidor y queda guardada al instante, **aunque no haya señal**.
- Después, la **copia** va al cliente: en *📤 Comprobantes por enviar* (pantalla de inicio del repartidor) toca **Enviar** → se abre WhatsApp con el número del cliente y un enlace a su comprobante firmado (foto, firma, fecha, GPS). Si no hay señal, la app avisa cuando vuelve.
- También puedes mandarlo **como imagen** (botón 🖼️ en el comprobante).

## Clientes SIN la app
- El repartidor toca **➕ Nueva entrega**, escribe nombre, celular y dirección del cliente, y empieza la ruta.
- Con **"Enviar seguimiento en vivo al cliente"** le llega por WhatsApp un enlace donde ve al repartidor en el mapa y la hora estimada de llegada. **No necesita instalar nada ni iniciar sesión.**
- Al entregar, el mismo enlace muestra el comprobante firmado y lo puede guardar como imagen.
- **El PIN es obligatorio.** Al crear la entrega toca **🔐 Enviar PIN y seguimiento por WhatsApp**: le llega su PIN con la advertencia de no compartirlo (si lo comparte, la empresa no se hace responsable). Al llegar, el cliente escribe su PIN en tu celular; sin PIN correcto no se puede entregar (máximo 5 intentos). Si lo perdió, se reenvía **solo a su número registrado**.
- **Clientes con la app:** chatean dentro de la app (con botón *Ir a WhatsApp*). **Clientes sin la app:** todo por WhatsApp.
- **Mensajes y ubicación por WhatsApp:** botones para *Ubicación en tiempo real* (la app te guía: 📎 → Ubicación → Compartir ubicación en tiempo real → 1 hora), *Mi ubicación ahora*, mensajes rápidos ("Llego en 5 minutos", "Ya estoy afuera") y llamada.

---


## Problemas comunes

| Problema | Solución |
|---|---|
| Se cierra la sesión cada hora | Ver la sección "Si la app pide iniciar sesión otra vez cada hora" (clave de API). |
| "El ingreso por celular no está activado" | Ver la sección "Activar el ingreso con número de celular". |
| `git` o `npm` "no se reconoce como comando" | Instala Git / Node (Paso 0) y **cierra y abre** el CMD. |
| `git push` pide usuario/contraseña | Usa la ventana de inicio de sesión de GitHub; si no aparece, instala Git de nuevo con las opciones por defecto (incluye "Git Credential Manager"). |
| `error: remote origin already exists` | Ya estaba conectado; sigue con `git push -u origin main`. |
| Netlify: "Build failed" | Revisa que subiste `package.json` y `netlify.toml`; en Netlify → Deploys → mira el error. |
| "auth/unauthorized-domain" al entrar con Google | Agrega tu dominio de Netlify en Firebase → Authentication → Dominios autorizados. |
| Sale "Modo demostración" en Netlify | Faltan las variables `VITE_FIREBASE_…` o falta *Trigger deploy*. |
| No aparezco como administrador | Tu Gmail debe estar en `VITE_ADMIN_EMAILS` **y** en `firestore.rules`. |
| "Missing or insufficient permissions" | Publica las reglas de `firestore.rules` con tu correo. |
| El repartidor no ve envíos | Debe estar **aprobado** en el Panel y **En línea**. |
| La huella no aparece | Solo con el enlace https (Netlify) y en teléfonos con huella/Face ID configurado. |
