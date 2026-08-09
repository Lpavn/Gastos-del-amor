# Contexto: carga automática por mail

Notas de esta sesión para no perder el hilo. Se puede borrar una vez que todo
esté funcionando y confirmado.

## Qué pasaba

El README ya describía la función "Carga automática por mail" (Google Apps
Script revisa Gmail y carga los movimientos solo), pero el código para que
funcione nunca se había subido al repo. Por eso "no andaba": no existía nada
del lado de la app a lo que el script le pudiera pegar.

## Qué se creó/modificó (ya está en la carpeta, falta hacer push)

- `app/api/import-email/route.ts` — endpoint nuevo. Recibe `{ secret, subject, from, text, person }`, valida `IMPORT_SECRET`, usa Gemini para leer el texto del mail y extraer el/los movimiento(s), y los inserta en Supabase con `source: "ai_email"`.
- `google-apps-script/Code.gs` — script para pegar en script.google.com. Función `revisarMails()`, configurable con `WEBHOOK_URL`, `SECRET` y `FUENTES` (label de Gmail → persona).
- `supabase/migration_email_auto.sql` — agrega `ai_email` como `source` válido en la tabla `transactions` (para bases ya existentes).
- `supabase/schema.sql` — actualizado para que instalaciones nuevas ya incluyan `ai_email` sin necesitar la migración.
- `lib/types.ts` — tipo `Transaction.source` acepta `"ai_email"`.
- `components/TransactionList.tsx` — muestra 📧 en los movimientos que vinieron por mail.
- `.env.example` — sumó `IMPORT_SECRET` y `EMAIL_IMPORT_PERSON`.
- `README.md` — reemplazado por la versión con la guía completa (Pasos A-D).

Verificado: `tsc --noEmit` sin errores, sintaxis de `Code.gs` válida.

## Pendiente (pasos del usuario, no de código)

1. **Push** de todo esto al repo de GitHub.
2. **Supabase**: correr `supabase/migration_email_auto.sql` en SQL Editor (la base ya existía antes de este cambio).
3. **Vercel** → Settings → Environment Variables: agregar `IMPORT_SECRET` (inventar un texto largo) y `EMAIL_IMPORT_PERSON` → luego **Redeploy**.
4. **Gmail**: crear un filtro + etiqueta por cada fuente (ej. `Santander-Gastos`, `MercadoPago-Gastos`) — Paso A del README.
5. **script.google.com**: crear proyecto nuevo con la MISMA cuenta de Gmail, pegar `google-apps-script/Code.gs`, completar `WEBHOOK_URL` (link de Vercel + `/api/import-email`), `SECRET` (igual a `IMPORT_SECRET`) y `FUENTES`. Ejecutar `revisarMails` una vez a mano para autorizar permisos.
6. **Trigger**: en el mismo editor, Activadores → `revisarMails` → cada 15 minutos.

Una vez hecho esto, los movimientos de las cuentas configuradas deberían
aparecer solos en la app, marcados con 📧.
