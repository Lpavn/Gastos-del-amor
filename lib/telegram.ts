// Helpers server-side para hablar con la Bot API de Telegram (gratis, sin
// límite de mensajes proactivos como WhatsApp). Se usa desde
// /api/telegram-webhook (mensajes entrantes) y /api/telegram-remind
// (recordatorio diario). Ver README > "Bot de Telegram" para el setup.

function apiUrl(method: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return `https://api.telegram.org/bot${token}/${method}`;
}

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  await fetch(apiUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Los dos chat_id autorizados a cargar movimientos, mapeados a su nombre
// (mismos nombres que NEXT_PUBLIC_PERSON_1_NAME / 2). Un chat_id vacío en el
// env simplemente deja a esa persona sin activar todavía.
export function personForChatId(chatId: number | string): string | null {
  const id = String(chatId);
  if (id && id === process.env.TELEGRAM_CHAT_ID_PERSON_1) {
    return process.env.NEXT_PUBLIC_PERSON_1_NAME || "Persona 1";
  }
  if (id && id === process.env.TELEGRAM_CHAT_ID_PERSON_2) {
    return process.env.NEXT_PUBLIC_PERSON_2_NAME || "Persona 2";
  }
  return null;
}

export function allChatIdsWithPerson(): { chatId: string; person: string }[] {
  const result: { chatId: string; person: string }[] = [];
  if (process.env.TELEGRAM_CHAT_ID_PERSON_1) {
    result.push({
      chatId: process.env.TELEGRAM_CHAT_ID_PERSON_1,
      person: process.env.NEXT_PUBLIC_PERSON_1_NAME || "Persona 1",
    });
  }
  if (process.env.TELEGRAM_CHAT_ID_PERSON_2) {
    result.push({
      chatId: process.env.TELEGRAM_CHAT_ID_PERSON_2,
      person: process.env.NEXT_PUBLIC_PERSON_2_NAME || "Persona 2",
    });
  }
  return result;
}
