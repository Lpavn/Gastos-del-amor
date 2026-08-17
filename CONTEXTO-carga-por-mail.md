# Contexto del proyecto — notas de sesión (actualizado 2026-08-17)

Notas para no perder el hilo entre sesiones. Se puede borrar cuando todo lo
de abajo esté confirmado y cerrado.

## -1. Ajuste 2026-08-17: compras en dólares con tarjeta de crédito

Bug reportado por Kiara: un mail de Santander de una compra en dólares
("Google One", U$S1,99, con la **Tarjeta Santander Visa Crédito terminada
en 9898**) se cargó solo como **2 ARS** — el pipeline nunca distinguió
moneda, `amount` siempre se guarda asumiendo pesos y a Gemini solo se le
pedía "el monto, sin símbolo de moneda".

Decisión de Kiara (no es un fix de conversión, es un cambio de flujo):
las compras con tarjeta de crédito **dejan de cargarse automáticamente por
mail**, todas — no solo las que vienen en dólares. En cambio, se van a
cargar todas juntas, una vez por mes, cuando Kiara suba una **captura del
resumen de la tarjeta** con "Foto con IA": ese resumen ya trae el monto
final convertido a pesos (el que realmente cobra el banco), así que no hay
que estimar ningún tipo de cambio.

Implementado:
- `app/api/import-email/route.ts`: nuevo campo `is_credit_card_purchase`
  en el schema de Gemini. La IA lo marca `true` cuando el mail dice
  explícitamente "Tarjeta ... **Crédito** terminada en ..." (a diferencia
  de "Débito"). Esos movimientos se filtran antes de insertar (nuevo
  contador `skippedCreditCardPurchase` en la respuesta del endpoint), igual
  que ya se hacía con `is_credit_card_bill_payment` (el débito del pago
  total del resumen, que se sigue salteando).
- `app/api/parse-receipt/route.ts`: el prompt de "Foto con IA" ahora
  menciona explícitamente el caso "resumen de tarjeta de crédito" —
  desglosa cada línea/consumo como movimiento aparte, ignora líneas de
  saldo/pago/intereses, y si una línea muestra dólares (u otra moneda) +
  su equivalente en pesos, usa siempre el monto en **pesos**.
- `README.md`: sección "Nota sobre compras con tarjeta de crédito"
  reescrita para explicar el nuevo flujo.
- Sin cambios en `google-apps-script/Code.gs` ni en el schema de Supabase:
  el filtro es todo downstream (Gemini + API), no hace falta tocar el
  script ni la base.

**Pendiente:**
- Kiara tiene que borrar a mano el movimiento viejo "Google One" cargado
  como 2 ARS (botón ✕ en la lista) — no se corrigió automáticamente desde
  acá.
- Falta que Kiara pruebe con una captura real del resumen de Santander
  para confirmar que el desglose y la conversión a pesos por línea
  funcionan bien (especialmente el caso de una línea en dólares).
- Sigue habiendo compras con tarjeta de **débito** que se cargan solas por
  mail como siempre — esto no cambió.

## 0. Ajuste 2026-08-10: reglas con nombre personalizado + UX más clara

Pedido de Kiara: el select de categoría en `EditTransactionModal` YA elegía
de la lista real de categorías (no era texto libre), pero el diseño no
dejaba claro que el checkbox "recordar" usaba esa categoría — se confundía
con el campo de texto "Alias / comercio" (que es otra cosa: el texto que
manda el banco para reconocer el mismo comercio en mails futuros, ej.
`MERPAGO*CENTRAL`).

Cambios:
- El checkbox ahora muestra en vivo la categoría elegida (emoji + nombre).
- Nuevo: cuando el checkbox está tildado aparece un campo "Nombre para
  mostrar" (ej. "Empanadas"). Si se completa, reemplaza la descripción
  cruda tanto en el movimiento actual como en los próximos que matcheen el
  mismo alias.
- Tabla `category_rules`: columna nueva `display_name` (nullable).
  Migración: `supabase/migration_rule_display_name.sql` (**falta correrla
  en el SQL Editor de Supabase** — `alter table category_rules add column
  if not exists display_name text;`). `schema.sql` actualizado para
  instalaciones nuevas.
- `app/api/import-email/route.ts`: si hay regla con `display_name`, se usa
  como `description` del movimiento importado (si no, queda la descripción
  que dedujo la IA).
- `lib/types.ts`: `CategoryRule.display_name`.

## 0.1 Ajuste 2026-08-10 (2): el alias ya no se escribe a mano

Kiara: "no quiero tener que completar el alias, eso tiene que ser el que
vino por defecto del mail automático". Se sacó el `<input>` editable del
alias/comercio: ahora se muestra como texto fijo ("Detectado del mail:
...") tomado de `transaction.merchant_key`, sin poder tocarlo. Si el
movimiento no tiene `merchant_key` (carga manual o la IA no lo detectó), se
oculta directamente la sección de "recordar categoría" con una aclaración,
porque no hay nada contra lo que matchear mails futuros.

## 1. Carga automática por mail — YA FUNCIONA (Santander)

- Root cause del bug original: el script pegado en script.google.com NO
  coincidía con `google-apps-script/Code.gs` del repo (era una versión vieja
  con otra lógica de logs). Se reemplazó por el código actual y ahora anda.
- Confirmado con una prueba real: `POST /api/import-email` con un mail real
  de Santander devolvió `{"imported": 1}`. Pipeline completo (Vercel →
  Gemini → Supabase) verificado end-to-end.
- Datos de la instalación actual:
  - URL de la app: `https://gastos-del-amor.vercel.app/`
  - `IMPORT_SECRET` en Vercel: `casa2026-xk93jd-secreto`
  - Label de Gmail activa: `Santander-Gastos`
  - `MercadoPago-Gastos` NO existe como label (el plan original era Mercado
    Pago, pero Kiara va a usar Banco Nación en su lugar — ver sección 4).
- Importante (no es un bug): un mail se reprocesa marcándolo como **no
  leído** en Gmail (`Shift+U`), no sacándole ninguna etiqueta. El script no
  usa etiquetas de "procesado", usa el estado leído/no leído.

## 2. Feature nueva: editar y eliminar movimientos

- `components/EditTransactionModal.tsx` (nuevo): tocando cualquier
  movimiento en la lista se abre una hoja inferior para editar fecha,
  monto, tipo, descripción, categoría, quién pagó — o eliminarlo (con
  confirmación).
- `components/TransactionList.tsx`: cada fila es ahora un botón que abre
  ese modal. Recibe `categories` completo (antes solo `categoryById`).
- `app/page.tsx`: pasa `categories` y `refresh` al listado.
- Ya pusheado a GitHub (commit "Modificar y eliminar movimientos").

## 3. Feature nueva: reglas de autocategorización por alias/comercio

Pedido de Kiara: cuando un mail llega con categoría "Otros" (ej. una
transferencia a un alias que la IA no reconoce), poder decirle a la app
"este alias siempre es Alquiler" y que la próxima vez se autocategorice.

Cómo quedó implementado:

- La IA (Gemini), al leer un mail, ahora también extrae `merchant_key`: el
  alias o nombre de comercio **copiado literal** del mail (no resumido), y
  se guarda en el movimiento.
- Tabla nueva `category_rules` (match_key → category_id) en Supabase.
- En `app/api/import-email/route.ts`: antes de insertar, se normaliza el
  `merchant_key` del mail y se busca si hay una regla guardada con ese
  match; si hay, esa categoría pisa lo que haya sugerido la IA.
- En `EditTransactionModal.tsx`: campo "Alias / comercio" editable
  (precargado con lo que detectó la IA) + checkbox "Recordar esta categoría
  para todos los movimientos con este alias/comercio". Al guardar con el
  checkbox tildado, hace upsert en `category_rules`.
- Archivos: `lib/merchantKey.ts` (nuevo), `lib/types.ts` (tipo
  `CategoryRule` + `merchant_key` en `Transaction`),
  `supabase/schema.sql` (actualizado), `supabase/migration_category_rules.sql`
  (nuevo — **ya corrido por Kiara en el SQL Editor de Supabase**).
- Documentado en el README, sección "Corregir la categoría para siempre".

## 4. Banco Nación (BNA) — investigado, todavía no configurado

El plan cambió: en vez de Mercado Pago, la segunda fuente de mails va a ser
Banco Nación. Investigué cómo activarlo (fuentes al final):

- BNA **no manda un mail por movimiento individual** como Santander. Tiene
  un "Servicio de Mensajes y Alertas" que es un **resumen periódico**
  (elegís qué días de la semana lo recibís) con "Consulta de Últimos
  Movimientos", "Saldos" o "Vencimientos".
- Ese servicio solo está en el **Home Banking clásico (web)**, no está
  migrado todavía a la app BNA+ (el banco está unificando ambas
  plataformas).
- Kiara nunca configuró usuario/clave de Home Banking. Para generarlo:
  - Opción 1: desde la app BNA+, si ya tiene validación digital, buscar
    "Creá tu usuario Home Banking" (pide datos de la tarjeta de débito).
  - Opción 2: cajero Red Link → Gestión de Claves → Home Banking/Banca
    Móvil → Obtención de clave (pide tarjeta de débito, da un ticket con
    "Número de Usuario").
  - Login web: `hb.redlink.com.ar/bna` (Home Banking clásico).
  - Una vez adentro: Opciones Personales → Servicio de mensajes y alertas →
    Agregar → "Consulta de Últimos Movimientos" → frecuencia diaria →
    confirmar con clave.

**Pendiente / riesgo a resolver cuando llegue el primer mail real de BNA:**
como es un resumen y no sabemos si trae "todo lo nuevo desde el mail
anterior" o "siempre los últimos N movimientos", podría haber
**duplicados** si el mismo movimiento aparece en dos resúmenes seguidos.
Falta: (a) que Kiara mande un mail de ejemplo real de BNA para ver el
formato, (b) ajustar el prompt de Gemini para leer una lista de varios
movimientos en un solo mail (el endpoint ya soporta `transactions: []`,
falta afinar el prompt), (c) posiblemente sumar una protección
antiduplicados (ej. no insertar si ya existe un movimiento igual en fecha +
monto + merchant_key).

## 5. Ualá — investigado, sin confirmar

No encontré evidencia de que Ualá mande mail por movimiento (a diferencia
de Santander/Mercado Pago). Lo que sí tiene confirmado es notificaciones
push dentro de la app. Pendiente que Kiara revise Perfil/Configuración →
Notificaciones en la app por si existe la opción de mail. Si no existe, la
alternativa es una app de automatización (ej. MacroDroid) que reenvíe el
texto de la notificación push como mail a Gmail, entrando al mismo
pipeline. Sin definir todavía — depende de lo que Kiara encuentre en la
app.

## 6. Bug de deploy en Vercel — fix a mitad de camino

Al pushear el commit de los puntos 2 y 3, se coló sin querer la carpeta
`menu-digital-demo/` (un proyecto sin relación, un demo de menú digital
para un local, que estaba suelto en la misma carpeta de Windows). Como
Next.js tipa todos los `.tsx` del repo al buildear, sus errores
(`Module has no exported member 'Product'`, etc.) rompieron el build de
Vercel.

Fix aplicado:
- `.gitignore` actualizado para excluir `menu-digital-demo/` y
  `tsconfig.tsbuildinfo`.
- **Pendiente que Kiara corra ella misma** (no se pudo desde este entorno
  por un lock de git en la carpeta sincronizada con OneDrive):
  ```powershell
  cd "C:\Users\Luca\OneDrive\Desktop\Gastos-del-amor"
  Remove-Item .git\index.lock -ErrorAction SilentlyContinue
  git rm -r --cached menu-digital-demo
  git rm --cached tsconfig.tsbuildinfo
  git add .gitignore
  git commit -m "Excluir menu-digital-demo y tsconfig.tsbuildinfo del repo"
  git push
  ```
- Falta confirmar que corrió esto y que el redeploy de Vercel pasó OK.

## Fuentes usadas (Banco Nación / Ualá)

- https://bna.com.ar/Home/ServicioDeMensajesYAlertas
- https://www.ambito.com/informacion-general/home-banking/bna-como-cambiar-mi-usuario-y-clave-homebanking-n5459118
- https://hb.redlink.com.ar/bna/login.htm?hb=clasico
- https://www.uala.com.ar/preguntas-frecuentes
- https://www.sirchandler.com.ar/2024/01/la-tarjeta-de-credito-de-uala-sin-costo-y-buen-limite/

## Próximos pasos (en orden)

1. Kiara corre los comandos git de la sección 6 y confirma que Vercel
   redeployó bien.
2. Kiara genera usuario/clave de Home Banking del BNA y activa el Servicio
   de Mensajes y Alertas (sección 4).
3. Cuando llegue el primer mail de BNA, Kiara lo pega en el chat para
   ajustar el prompt/parsing y evaluar el tema duplicados.
4. Kiara revisa notificaciones de Ualá (sección 5) y define si hace falta
   el workaround de MacroDroid.
