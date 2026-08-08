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
   | `GEMINI_MODEL` | `gemini-2.5-flash` (podés dejarlo así) |
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
