/**
 * Gastos del amor — revisa Gmail y manda los mails nuevos a la app.
 *
 * Configuración (ver README.md, sección "Carga automática por mail"):
 *   1. Reemplazá WEBHOOK_URL por tu link de Vercel + /api/import-email
 *   2. Reemplazá SECRET por el mismo valor que pusiste en IMPORT_SECRET (Vercel)
 *   3. Completá FUENTES con una fila por cada etiqueta de Gmail que creaste
 *   4. Guardá, ejecutá revisarMails() una vez a mano para autorizar permisos,
 *      y después creá el activador (Triggers) cada 15 minutos.
 */

const WEBHOOK_URL = "https://TU-APP.vercel.app/api/import-email"; // <-- reemplazar
const SECRET = "TU_IMPORT_SECRET"; // <-- mismo valor que IMPORT_SECRET en Vercel

// Una fila por cada etiqueta que creaste en el Paso A del README.
const FUENTES = [
  { label: "Santander-Gastos", person: "Kiara" },
  { label: "MercadoPago-Gastos", person: "Kiara" },
];

// Cuántos hilos revisar como máximo por fuente en cada corrida (de sobra
// para 15 minutos de mails, evita corridas eternas si algo queda sin marcar).
const MAX_THREADS_POR_FUENTE = 20;

function revisarMails() {
  if (!WEBHOOK_URL || WEBHOOK_URL.indexOf("TU-APP") !== -1) {
    Logger.log("Falta configurar WEBHOOK_URL arriba del script.");
    return;
  }
  if (!SECRET || SECRET === "TU_IMPORT_SECRET") {
    Logger.log("Falta configurar SECRET arriba del script.");
    return;
  }

  FUENTES.forEach(function (fuente) {
    try {
      procesarFuente(fuente);
    } catch (err) {
      Logger.log("Error procesando " + fuente.label + ": " + err);
    }
  });
}

function procesarFuente(fuente) {
  const query = 'label:"' + fuente.label + '" is:unread';
  const threads = GmailApp.search(query, 0, MAX_THREADS_POR_FUENTE);

  if (threads.length === 0) {
    Logger.log(fuente.label + ": sin mails nuevos.");
    return;
  }

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      if (!message.isUnread()) return;

      const ok = enviarMail(message, fuente.person);
      // Solo marcamos como leído si la app confirmó que lo recibió bien.
      // Si falla (app caída, error de red, etc.) lo dejamos sin leer para
      // que se reintente solo en la próxima corrida, 15 minutos después.
      if (ok) {
        message.markRead();
      }
    });
  });
}

function enviarMail(message, person) {
  const payload = {
    secret: SECRET,
    subject: message.getSubject(),
    from: message.getFrom(),
    text: message.getPlainBody(),
    person: person,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
  const code = response.getResponseCode();

  if (code >= 200 && code < 300) {
    Logger.log("OK (" + person + "): " + message.getSubject() + " -> " + response.getContentText());
    return true;
  }

  Logger.log("Error " + code + " (" + person + "): " + response.getContentText());
  return false;
}
