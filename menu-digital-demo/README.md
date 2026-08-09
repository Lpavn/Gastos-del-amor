# Menú Digital + Pedidos — Demo de portfolio 🍽️

App de muestra para mostrarle a comercios chicos (bares, restaurantes,
cafeterías) qué se puede construir con esta misma estructura de "Gastos del
Amor": el cliente escanea un QR en la mesa, ve la carta, arma su pedido y lo
manda; el dueño lo ve aparecer al instante en un panel propio, gestiona la
carta (con carga de productos asistida por IA a partir de una foto) y mira
estadísticas de ventas.

No es un producto para un cliente real todavía — es la pieza que mostrás en
la primera reunión para demostrar capacidad técnica. Al final de este archivo
hay una sección sobre cómo usarla para vender.

## Qué incluye

- **`/menu`** — vista del cliente: carta por categorías, carrito, checkout
  (nombre + mesa + notas), confirmación con número de pedido. Sin login.
- **`/admin`** — vista del dueño, protegida con PIN:
  - **Pedidos**: tablero en tiempo real (aparecen solos, sin recargar),
    con botón para avanzar estado (Nuevo → En preparación → Listo → Entregado).
  - **Carta**: alta/baja/edición de productos y categorías, pausar
    disponibilidad, y un botón **"✨ Completar con IA"** — se saca una foto
    del plato o de una página del menú impreso y la IA completa nombre,
    descripción, precio y categoría solos.
  - **Estadísticas**: ventas de hoy / últimos 7 días, ticket promedio,
    gráfico de ventas por día y ranking de productos más vendidos.

## Stack (igual a Gastos del Amor, 100% gratis para este uso)

Next.js 14 + TypeScript + Tailwind · Supabase (base de datos + tiempo real +
fotos) · Google Gemini (IA para leer fotos) · Vercel (hosting) · Recharts
(gráficos).

## Paso 1 — Crear la base de datos en Supabase

1. [supabase.com](https://supabase.com) → **New project**.
2. **SQL Editor → New query** → pegá todo el contenido de
   `supabase/schema.sql` → **Run**. Esto crea las tablas, activa el tiempo
   real, y carga una carta de ejemplo para que la demo no arranque vacía.
3. **Storage → New bucket** → nombre `menu-photos` → marcá **Public bucket**
   → Create. (Ahí se guardan las fotos de los productos).
4. **Settings → API Keys** → copiá **Project URL** y la **Publishable /
   anon key** (no la "Secret key").

## Paso 2 — API key de Google Gemini (gratis)

[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) →
**Create API key**. No pide tarjeta; el nivel gratuito de Gemini Flash
alcanza de sobra para una demo.

## Paso 3 — Subir a GitHub y desplegar en Vercel

1. Subí esta carpeta a un repositorio nuevo en GitHub (puede ser privado).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importá el
   repo.
3. Antes de Deploy, cargá en **Environment Variables**:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key de Supabase |
   | `GEMINI_API_KEY` | tu API key de Gemini |
   | `GEMINI_MODEL` | `gemini-2.5-flash` |
   | `NEXT_PUBLIC_APP_PIN` | PIN de 4 dígitos para el panel (ej. `1234`) |

4. **Deploy**. En 1-2 minutos tenés el link (ej. `menu-demo.vercel.app`).

## Desarrollo local (opcional)

```
cp .env.example .env.local   # completá los valores
npm install
npm run dev
```

## Cómo usar esto para conseguir clientes

Esta demo está pensada para mostrarse tal cual, sin tocar código, en una
reunión: abrís `/menu` desde tu celular como si fueras el cliente del local,
mostrás cómo llega el pedido en tiempo real a `/admin/pedidos`, y cerrás con
la carga de un producto nuevo sacándole una foto (el momento "ah, mirá esto"
de la demo).

**Para adaptarla a un comercio real** una vez que consigas el primer cliente:

- Cambiá nombre del local, colores (`tailwind.config.ts`, color `brand`) y
  categorías/productos de ejemplo por los reales.
- Reemplazá el PIN por algo propio del cliente, o subí este punto a auth
  real de Supabase si el comercio va a tener más de una persona usando el
  panel (mozo, cocina, dueño con permisos distintos).
- Desplegá una copia por cliente (proyecto Supabase + proyecto Vercel
  propios) — así los datos de cada comercio quedan aislados y cada uno paga
  (o no) su propia infraestructura.
- El costo real para vos: mientras el cliente esté en los niveles gratuitos
  de Supabase/Vercel, no pagás nada de infraestructura — cobrás por el
  trabajo de armado, personalización y soporte. Si el comercio crece y
  necesita el plan pago de Vercel (~USD 20/mes) o Supabase, ese costo se
  traslada a la cuota mensual que le cobres.
- La misma estructura (carta → pedidos → estadísticas, con o sin IA) se
  adapta con pocos cambios a: reserva de turnos (peluquerías, consultorios),
  catálogo + stock (kioscos, tiendas), o pedidos para llevar por WhatsApp.

## Notas importantes

- **Seguridad**: como en Gastos del Amor, no hay login real — el panel se
  protege solo con el PIN del navegador y la base de datos queda con
  acceso público (clave anónima) para simplificar la demo. Antes de vender
  esto a un cliente real, sumar Supabase Auth con roles es el paso
  obligatorio (ver sección anterior).
- Si un día ves el error `model ... is no longer available`: cambiá
  `GEMINI_MODEL` en Vercel a `gemini-flash-latest` y hacé Redeploy.
