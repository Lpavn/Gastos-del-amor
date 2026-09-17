import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { personForChatId, sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const categoryNames = DEFAULT_CATEGORIES.map((c) => c.name);

// Un mensaje de texto corto tipo "$15.550 verdulería" o "cobré 20000 de
// changas ayer". Mismo criterio de categorías/tipo que los otros endpoints
// de IA, pero sin foto ni mail: solo el texto que escribió la persona.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_movement: {
      type: Type.BOOLEAN,
      description:
        "true si el mensaje describe un movimiento de plata con al menos un monto. false para saludos, preguntas, o cualquier texto que no sea cargar un gasto/ingreso.",
    },
    date: {
      type: Type.STRING,
      description:
        "Fecha en formato YYYY-MM-DD. Si el mensaje dice 'ayer', 'antier', un día de la semana, etc., calculala en base a hoy. Si no dice nada, usar hoy.",
    },
    type: {
      type: Type.STRING,
      enum: ["expense", "income"],
      description: "expense por defecto. income solo si dice claramente que cobró/le pagaron/ingresó plata.",
    },
    amount: {
      type: Type.NUMBER,
      description: "Monto en valor absoluto, sin símbolo de moneda ni puntos de miles.",
    },
    description: {
      type: Type.STRING,
      description: "Descripción breve del gasto/ingreso (comercio o concepto), tomada del mensaje.",
    },
    category_name: {
      type: Type.STRING,
      enum: categoryNames,
      description: "La categoría más adecuada de la lista permitida.",
    },
  },
  required: ["is_movement", "date", "type", "amount", "description", "category_name"],
};

async function parseMovement(text: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY");

  const ai = new GoogleGenAI({ apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Hoy es ${today}. Una persona te mandó este mensaje de chat para cargar un movimiento de plata:\n"""\n${text.slice(0, 500)}\n"""\nExtraé el movimiento. Categorías permitidas: ${categoryNames.join(", ")}.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  if (!response.text) return null;
  return JSON.parse(response.text);
}

export async function POST(req: NextRequest) {
  try {
    // Telegram manda este header con el secret_token que le pasamos al
    // registrar el webhook (ver README), para que nadie más pueda pegarle a
    // esta URL pública y simular mensajes.
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (!process.env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const update = await req.json().catch(() => null);
    const message = update?.message;
    const chatId: number | undefined = message?.chat?.id;
    const text: string | undefined = message?.text;

    if (!chatId || !text) {
      return NextResponse.json({ ok: true }); // otro tipo de update, ignorar
    }

    if (text.trim() === "/start") {
      await sendTelegramMessage(
        chatId,
        `¡Hola! Tu chat_id es ${chatId}.\n\nPasáselo a quien administra la app de gastos para que te active (variable TELEGRAM_CHAT_ID_PERSON_1 o _2 en Vercel). Una vez activo, mandame mensajes tipo "$15.550 verdulería" y los cargo solo.`
      );
      return NextResponse.json({ ok: true });
    }

    const person = personForChatId(chatId);
    if (!person) {
      await sendTelegramMessage(chatId, "Todavía no estás activado para cargar movimientos. Mandá /start y pasale tu chat_id a quien administra la app.");
      return NextResponse.json({ ok: true });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 });
    }

    const parsed = await parseMovement(text);
    if (!parsed || !parsed.is_movement || !parsed.amount) {
      await sendTelegramMessage(
        chatId,
        "No pude entender un monto ahí. Probá con algo tipo \"$15.550 verdulería\" o \"cobré 20000 changas\"."
      );
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: categories } = await supabase.from("categories").select("id, name");
    const categoryId = categories?.find((c) => c.name === parsed.category_name)?.id ?? null;
    const category = categories?.find((c) => c.id === categoryId);

    const { error } = await supabase.from("transactions").insert([
      {
        date: parsed.date,
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description,
        category_id: categoryId,
        paid_by: person,
        source: "ai_chat" as const,
      },
    ]);

    if (error) {
      await sendTelegramMessage(chatId, "Se pudo leer el mensaje pero no se guardó: " + error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sign = parsed.type === "income" ? "+" : "-";
    await sendTelegramMessage(
      chatId,
      `✅ Cargado: ${sign}$${parsed.amount} · ${parsed.description} · ${category?.emoji || ""} ${parsed.category_name} · ${parsed.date}\n\nSi está mal, corregilo desde la app.`
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message || "Error inesperado." }, { status: 500 });
  }
}
