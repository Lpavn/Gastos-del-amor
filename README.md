# App de Gastos 🏡

Web app para manejar los gastos e ingresos de una casa entre dos personas: subís
una foto de un ticket o comprobante desde el celular, la IA lee el monto, la
fecha y la categoría, y el balance en conjunto se actualiza solo (en tiempo
real) en los dos celulares. Incluye estadísticas por mes y por año.

No es una app de la App Store / Play Store: es una web app que se agrega a la
pantalla de inicio del celular y funciona como una app normal.

## Qué vas a necesitar (todo 100% gratis, sin tarjeta)

1. Una cuenta en **[Supabase](https://supabase.com)** (base de datos + fotos).
2. Una cuenta en **[Vercel](https://vercel.com)** (para que la app viva en un link).
3. Una **API key de Google Gemini** en [aistudio.google.com](https://aistudio.google.com/app/apikey)
   (la que lee las fotos). El nivel gratuito de Gemini alcanza de sobra para
   el uso de una pareja cargando tickets, no requiere tarjeta.
4. Una cuenta de **GitHub** (para subir el código y conectarlo a Vercel).

## Paso 1 — Crear la base de datos en Supabase

1. Entrá a supabase.com → **New project**. Elegí un nombre y una contraseña
   (guardala, no hace falta usarla después).
2. Cuando el proyecto esté listo, andá a **SQL Editor → New query**.
3. Abrí el archivo `supabase/schema.sql` de esta carpeta, copiá todo el
   contenido, pegalo ahí y tocá **Run**. Esto crea las tablas de categorías y
   movimientos.
4. Andá a **Storage → New bucket**. Nombre: `receipts`. Marcá la opción
   **Public bucket** (para que las fotos se puedan ver desde la app). Create.
5. Andá a **Settings → API Keys**. Vas a necesitar dos valores para el paso 3:
   - **Project URL** (pestaña General, o arriba de esta misma página) → va en `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (empieza con `sb_publishable_...`, es la clave pública
     para el navegador) → va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Ojo: NO uses la de "Secret keys" (`sb_secret_...`), esa es privada y no
     la necesitás acá.
   - *(Si tu proyecto es viejo y ves "anon" / "service_role" en vez de
     "Publishable" / "Secret", usá la pestaña "Legacy anon, service_role API
     keys" y tomá la `anon` — funciona igual.)*

## Paso 2 — Conseguir la API key de Google Gemini (gratis)

1. Entrá a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   con tu cuenta de Google → **Create API key**.
2. Copiala, va en `GEMINI_API_KEY` (¡ojo, NO lleva el prefijo `NEXT_PUBLIC_`!).
3. No hace falta cargar tarjeta ni crédito: el nivel gratuito de Gemini Flash
   tiene un límite diario de solicitudes de sobra para cargar tickets entre
   dos personas. Si algún día lo superan, Google simplemente rechaza esa
   solicitud puntual (no te cobra nada) y pueden reintentar al otro día.

## Paso 3 — Subir el código a GitHub

1. Creá un repositorio nuevo (puede ser privado) en github.com.
2. Subí todo el contenido de esta carpeta (`app-gastos`) a ese repositorio.
   Si nunca usaste git, la forma más simple es: en GitHub, "uploading an
   existing file" y arrastrar todos los archivos, o pedirle a alguien con
   experiencia que te ayude con `git init / add / commit / push`.

## Paso 4 — Desplegar en Vercel

1. Entrá a vercel.com → **Add New → Project** → importá el repositorio que
   acabás de crear.
2. Antes de tocar Deploy, abrí **Environment Variables** y cargá estas (los
   valores salen de los pasos 1 y 2):

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | el Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la anon public key de Supabase |
   | `GEMINI_API_KEY` | tu API key de Google Gemini |
   | `GEMINI_MODEL` | `gemini-flash-latest` (podés dejarlo así) |
   | `NEXT_PUBLIC_PERSON_1_NAME` | tu nombre, ej. `Kiara` |
   | `NEXT_PUBLIC_PERSON_2_NAME` | el nombre de tu pareja |
   | `NEXT_PUBLIC_APP_PIN` | un PIN de 4 dígitos para proteger el acceso (o dejalo vacío) |

3. Tocá **Deploy**. En 1-2 minutos te da un link (ej. `app-gastos.vercel.app`).

## Paso 5 — Usarla desde el celular

1. Abrí el link de Vercel en el navegador del celular (Safari en iPhone,
   Chrome en Android).
2. Ingresá el PIN si configuraste uno, y elegí quién sos vos en ese celular
   (esto se guarda solo en tu dispositivo).
3. Agregala a la pantalla de inicio:
   - **iPhone**: botón de compartir → "Agregar a pantalla de inicio".
   - **Android**: menú (⋮) → "Agregar a pantalla principal" / "Instalar app".
4. Repetí el paso 3 en el celular de tu pareja.

Desde ahí queda como un ícono más, se abre a pantalla completa y ambos ven el
mismo balance actualizado en tiempo real.

## Cómo se usa

- **Foto con IA**: sacás una foto a un ticket, comprobante o a la pantalla con
  el resumen de movimientos del banco. La IA detecta uno o varios movimientos,
  te los muestra para revisar/corregir (fecha, monto, categoría, quién pagó) y
  recién ahí se guardan.
- **Manual**: para cargar un movimiento a mano sin foto.
- **Inicio**: balance en conjunto (ingresos - gastos) y cuánto aportó/gastó
  cada uno, con los últimos movimientos.
- **Estadísticas**: gastos por categoría en el mes o año elegido, y un gráfico
  comparando los meses del año.

## Carga automática por mail (opcional)

Ni los bancos argentinos ni Mercado Pago tienen una forma oficial de conectar
la cuenta a una app de terceros — no existe un "open banking" como en otros
países. Lo que sí se puede hacer, sin compartir nunca tu usuario ni contraseña:
si te llega un mail por cada movimiento (Santander, Mercado Pago, cualquier
billetera virtual), ese mail se puede reenviar solo a la app para que se
cargue automáticamente.

**Cómo funciona:** un script gratuito de Google (Google Apps Script) revisa
tu Gmail cada 15 minutos, uno por uno, por cada "fuente" que hayas configurado
(Santander, Mercado Pago, etc.), y le manda el texto de los mails nuevos a la
app para que la IA lo lea y cargue el movimiento a nombre de quien corresponda.
Todo dentro de tu propia cuenta de Gmail, sin instalar nada raro ni compartir
contraseñas de bancos ni de Mercado Pago.

> **¿Los mails te llegan a Outlook y no a Gmail?** El script solo puede leer
> Gmail, pero no hace falta cambiar nada del código: configurá en Outlook una
> regla que reenvíe esos mails a una cuenta de Gmail (puede ser cualquiera que
> uses, incluso una nueva creada solo para esto). En Outlook: abrí uno de los
> mails → **⋮ → Crear regla** → condición "De" contiene la dirección del
> remitente → acción **Reenviar a** → tu Gmail. Guardá, y seguí los pasos A-D
> de abajo normalmente en ese Gmail.

### Paso A — Etiquetar los mails en Gmail (uno por cada fuente)

Repetí esto una vez por cada cuenta que quieras sumar (Santander, Mercado
Pago, etc.):

1. Abrí uno de los mails que te manda esa cuenta por cada movimiento y anotá
   la dirección de quién lo envía (ej. `alertas@santanderrio.com.ar` para
   Santander, o el remitente de Mercado Pago que veas en tu bandeja — suele
   ser algo como `Mercado Pago <mercadopago@mercadopago.com.ar>`).
2. En Gmail, buscá ese remitente → tres puntos → **Crear filtro**.
3. En el filtro, elegí **Aplicar la etiqueta** → **Crear nueva** → llamala
   `Santander-Gastos` (para Santander) o `MercadoPago-Gastos` (para Mercado
   Pago) → **Crear filtro**.
4. A partir de ahora, todo mail nuevo de esa cuenta se etiqueta solo.

### Paso B — Generar el secreto

En Vercel → tu proyecto → **Settings → Environment Variables**, agregá:

| Variable | Valor |
|---|---|
| `IMPORT_SECRET` | inventá cualquier texto largo y raro, ej. `casa2026-xk93jd-secreto` |
| `EMAIL_IMPORT_PERSON` | nombre por defecto si alguna vez falta el dato (podés dejar `Kiara`) |

Guardá y hacé **Redeploy** del proyecto para que tomen efecto.

### Paso C — Crear el script en Google

1. Entrá a [script.google.com](https://script.google.com) con la MISMA cuenta
   de Gmail donde te llegan los mails → **Nuevo proyecto**.
2. Borrá el código de ejemplo y pegá el contenido de `google-apps-script/Code.gs`
   (está en esta carpeta).
3. Arriba de todo, reemplazá:
   - `WEBHOOK_URL` → tu link de Vercel + `/api/import-email` (ej.
     `https://gastos-del-amor.vercel.app/api/import-email`)
   - `SECRET` → el mismo texto que pusiste en `IMPORT_SECRET`
   - `FUENTES` → una fila por cada etiqueta que creaste en el Paso A, con el
     nombre de quién es esa cuenta. Ya viene con Santander y Mercado Pago de
     ejemplo, solo tenés que revisar los nombres:
     ```js
     const FUENTES = [
       { label: "Santander-Gastos", person: "Kiara" },
       { label: "MercadoPago-Gastos", person: "Kiara" },
     ];
     ```
     Si Mercado Pago es de tu pareja, esa fila diría `person: "Pareja"` (o el
     nombre que uses). Podés agregar todas las filas que necesites.
4. Guardá el proyecto (ícono de disquete, ponele un nombre como "Gastos Auto").
5. Arriba, en el selector de funciones, elegí `revisarMails` y tocá
   **Ejecutar** (▶). La primera vez te va a pedir autorizar permisos: elegí tu
   cuenta → "Avanzado" → "Ir a (nombre del proyecto), no seguro" → Permitir.
   (Es tu propio script personal, por eso Google muestra esa advertencia).
6. Mirá los "Registros de ejecución" para ver si encontró mails o no.

### Paso D — Automatizarlo

1. En el panel izquierdo del editor, tocá el ícono de **reloj (Activadores)**.
2. **Añadir activador** → función `revisarMails` → Origen del evento
   **Basado en tiempo** → **Temporizador de minutos** → **Cada 15 minutos** →
   Guardar.

Listo — de ahí en más, cada movimiento de las cuentas que configuraste (si
mandan mail) va a aparecer solo en la app en menos de 15 minutos, marcado con
el ícono 📧, a nombre de la persona que le pusiste en `FUENTES`. Como toda
carga con IA, puede equivocarse alguna vez: en la lista de movimientos de la
app tenés un botón (✕) para borrar cualquiera que esté mal.

**¿Querés sumar otra fuente más adelante?** Repetí el Paso A con esa cuenta,
agregá una fila nueva en `FUENTES` dentro del script, guardá — no hace falta
tocar el trigger ni nada más, la misma función `revisarMails` ya las revisa
todas.

**Si ya habías corrido `supabase/schema.sql` antes de agregar esto**, corré
también `supabase/migration_email_auto.sql` en el SQL Editor de Supabase.

### Corregir la categoría para siempre (reglas por alias/comercio)

Cuando un mail se carga solo, a veces la IA no reconoce el comercio o el
alias de una transferencia y lo manda a "Otros". Para que no vuelva a pasar
con esa misma cuenta/alias:

1. En la app, tocá ese movimiento para abrir el editor.
2. Fijate el campo **"Alias / comercio"**: ya viene completado con lo que la
   IA detectó en el mail (por ejemplo el alias de una transferencia o el
   nombre del comercio). Corregilo si hace falta.
3. Elegí la categoría correcta y tildá **"Recordar esta categoría para todos
   los movimientos con este alias/comercio"** → Guardar cambios.

De ahí en más, cualquier mail nuevo que mencione ese mismo alias/comercio se
va a cargar directo con esa categoría, sin pasar por "Otros".

**Si ya habías corrido `supabase/schema.sql` antes de agregar esto**, corré
también `supabase/migration_category_rules.sql` en el SQL Editor de Supabase.

## Si la foto con IA deja de funcionar (error "model ... is no longer available")

Google discontinúa versiones viejas de Gemini de vez en cuando. Si un día ves
un error así, arreglalo sin tocar código: Vercel → tu proyecto → **Settings →
Environment Variables** → editá `GEMINI_MODEL` (probá `gemini-flash-latest`,
o si eso también falla, mirá en [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)
el nombre del modelo Flash vigente) → **Deployments → Redeploy**.

## Notas importantes

- **Seguridad**: esta app no tiene login real, se protege solo con el PIN de
  la pantalla de entrada. Está pensada para uso privado entre dos personas.
  No compartas el link ni subas el repositorio a GitHub como público con las
  claves incluidas (usá siempre variables de entorno, nunca las pegues
  directo en el código).
- **Costo**: Supabase, Vercel y Gemini (nivel gratuito) no tienen costo para
  este uso. No hace falta cargar tarjeta en ningún lado.
- **Categorías**: si querés agregar o cambiar categorías, se editan en dos
  lugares: la tabla `categories` en Supabase (podés hacerlo desde el propio
  Dashboard de Supabase, pestaña Table Editor) y el archivo `lib/categories.ts`
  (para que la IA sepa que existen).
- **Desarrollo local** (opcional, si querés probar cambios antes de subirlos):
  copiá `.env.example` a `.env.local`, completá los valores, y corré:
  ```
  npm install
  npm run dev
  ```
