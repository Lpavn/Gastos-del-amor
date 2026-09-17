import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { personForChatId, sendTelegramMessage } from "@/lib/telegram";
import { formatMoney } from "@/lib/format";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const categoryNames = DEFAULT_CATEGORIES.map((c) => c.name);

// Un cambio en bulk que toque más movimientos que esto se rechaza: casi
// seguro es un filtro mal armado (demasiado amplio) antes que algo que la
// persona realmente quiso hacer de una.
const MAX_BULK_MATCHES = 200;
// Cuánto dura en pie una propuesta de bulk sin confirmar.
const PENDING_EXPIRY_MINUTES = 15;

let ai: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Falta GEMINI_API_KEY");
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

// ---------------------------------------------------------------------------
// 1) Clasificar qué quiere la persona: cargar un movimiento, preguntar/
// analizar (solo lectura), o editar/borrar varios movimientos a la vez.
// ---------------------------------------------------------------------------
const INTENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: ["log", "query", "bulk_edit", "bulk_delete", "unclear"],
      description:
        "log: describe UN movimiento nuevo para cargar (ej. '$15.550 verdulería'). " +
        "query: pregunta o pide un análisis de datos YA cargados, sin cambiar nada (ej. 'cuánto gasté en comida este mes', 'cuál es el balance'). " +
        "bulk_edit: pide MODIFICAR varios movimientos existentes que ya están cargados (ej. 'cambiá todos los de Su favorita de 4000 a 3000', 'poné categoría Mascotas a todo lo de Pet Shop'). " +
        "bulk_delete: pide BORRAR varios movimientos existentes (ej. 'borrá todos los de Netflix'). " +
        "unclear: saludo, no tiene sentido, o no entra en ninguna categoría anterior.",
    },
  },
  required: ["intent"],
};

async function classifyIntent(text: string): Promise<"log" | "query" | "bulk_edit" | "bulk_delete" | "unclear"> {
  const response = await getAi().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: `Mensaje de chat: "${text.slice(0, 500)}"` }] }],
    config: { responseMimeType: "application/json", responseSchema: INTENT_SCHEMA },
  });
  if (!response.text) return "unclear";
  return JSON.parse(response.text).intent || "unclear";
}

// ---------------------------------------------------------------------------
// 2a) Cargar un movimiento nuevo (mismo criterio que antes).
// ---------------------------------------------------------------------------
const LOG_SCHEMA = {
  type: Type.OBJECT,
  properties: {
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
    amount: { type: Type.NUMBER, description: "Monto en valor absoluto, sin símbolo de moneda ni puntos de miles." },
    description: { type: Type.STRING, description: "Descripción breve del gasto/ingreso (comercio o concepto)." },
    category_name: { type: Type.STRING, enum: categoryNames, description: "La categoría más adecuada de la lista permitida." },
  },
  required: ["date", "type", "amount", "description", "category_name"],
};

async function parseLog(text: string, today: string) {
  const response = await getAi().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: `Hoy es ${today}. Extraé el movimiento de plata de este mensaje:\n"""\n${text.slice(0, 500)}\n"""\nCategorías permitidas: ${categoryNames.join(", ")}.` }],
      },
    ],
    config: { responseMimeType: "application/json", responseSchema: LOG_SCHEMA },
  });
  if (!response.text) return null;
  return JSON.parse(response.text);
}

// ---------------------------------------------------------------------------
// 2b) Preguntar/analizar (solo lectura, no toca la base).
// ---------------------------------------------------------------------------
const QUERY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    start_date: { type: Type.STRING, description: "Inicio del período en YYYY-MM-DD. Si no menciona período, usar el primer día del mes actual." },
    end_date: { type: Type.STRING, description: "Fin del período en YYYY-MM-DD. Si no menciona período, usar hoy." },
    type: { type: Type.STRING, enum: ["expense", "income", "both"], description: "Si pregunta por gastos: expense. Por ingresos: income. Por balance o no lo aclara: both." },
    category_name: { type: Type.STRING, enum: categoryNames, description: "Categoría por la que filtra. Omitir este campo si no menciona ninguna." },
    person_scope: {
      type: Type.STRING,
      enum: ["me", "other", "both"],
      description: "'me' si pregunta por SUS PROPIOS gastos/ingresos ('cuánto gasté yo'). 'other' si pregunta por los del otro integrante de la pareja por su nombre. 'both' si pregunta en general (o no lo aclara).",
    },
    breakdown_by_category: {
      type: Type.BOOLEAN,
      description:
        "true si pregunta CUÁL categoría es la mayor/menor, o pide comparar/rankear categorías entre sí (ej. 'qué categoría fue el mayor gasto', 'gastos por categoría'). false para pedir un total simple.",
    },
  },
  required: ["start_date", "end_date", "type", "person_scope", "breakdown_by_category"],
};

async function parseQuery(text: string, today: string) {
  const response = await getAi().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: `Hoy es ${today}. La persona pregunta esto sobre sus movimientos ya cargados:\n"""\n${text.slice(0, 500)}\n"""\nCategorías permitidas: ${categoryNames.join(", ")}.` }],
      },
    ],
    config: { responseMimeType: "application/json", responseSchema: QUERY_SCHEMA },
  });
  if (!response.text) return null;
  return JSON.parse(response.text);
}

// ---------------------------------------------------------------------------
// 2c) Editar o borrar varios movimientos existentes a la vez.
// ---------------------------------------------------------------------------
const BULK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    filter_text: {
      type: Type.STRING,
      description: "Palabra o frase que debe aparecer en la descripción o el alias/comercio de los movimientos a buscar (copiada del mensaje). Vacío si no menciona ninguna.",
    },
    filter_amount: { type: Type.NUMBER, description: "Monto exacto por el que filtrar. 0 si no menciona un monto para buscar." },
    filter_category_name: { type: Type.STRING, enum: categoryNames, description: "Categoría por la que filtrar. Omitir este campo si no menciona ninguna." },
    filter_type: { type: Type.STRING, enum: ["expense", "income", "any"], description: "expense o income si lo aclara, any si no." },
    change_amount: { type: Type.NUMBER, description: "SOLO para bulk_edit: nuevo monto a poner. 0 si no cambia el monto." },
    change_category_name: { type: Type.STRING, enum: categoryNames, description: "SOLO para bulk_edit: nueva categoría a poner. Omitir este campo si no la cambia." },
    change_description: { type: Type.STRING, description: "SOLO para bulk_edit: nueva descripción a poner. Vacío si no la cambia." },
  },
  required: ["filter_text", "filter_amount", "filter_type", "change_amount", "change_description"],
};

async function parseBulk(text: string) {
  const response = await getAi().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: `La persona pide modificar o borrar movimientos YA cargados (no es uno nuevo):\n"""\n${text.slice(0, 500)}\n"""\nCategorías permitidas: ${categoryNames.join(", ")}. Si el monto que menciona es "de 4000 a 3000", 4000 es el filtro (filter_amount) y 3000 es el cambio (change_amount).` }],
      },
    ],
    config: { responseMimeType: "application/json", responseSchema: BULK_SCHEMA },
  });
  if (!response.text) return null;
  return JSON.parse(response.text);
}

// ---------------------------------------------------------------------------
// Helpers de datos
// ---------------------------------------------------------------------------
type CatRow = { id: number; name: string };

async function findBulkMatches(supabase: SupabaseClient, categories: CatRow[], f: any) {
  let query = supabase
    .from("transactions")
    .select("id, date, amount, type, description, merchant_key, category_id");
  if (f.filter_type !== "any") query = query.eq("type", f.filter_type);

  const { data } = await query;
  let rows = (data || []) as any[];

  if (f.filter_text) {
    const needle = String(f.filter_text).toLowerCase();
    rows = rows.filter(
      (r) => (r.description || "").toLowerCase().includes(needle) || (r.merchant_key || "").toLowerCase().includes(needle)
    );
  }
  if (f.filter_amount > 0) {
    rows = rows.filter((r) => Math.abs(Number(r.amount) - f.filter_amount) < 1);
  }
  if (f.filter_category_name) {
    const catId = categories.find((c) => c.name === f.filter_category_name)?.id;
    rows = rows.filter((r) => r.category_id === catId);
  }
  return rows;
}

function hasRealFilter(f: any): boolean {
  return Boolean(f.filter_text) || f.filter_amount > 0 || Boolean(f.filter_category_name);
}

function hasRealChange(f: any): boolean {
  return f.change_amount > 0 || Boolean(f.change_category_name) || Boolean(f.change_description);
}

export async function POST(req: NextRequest) {
  // Fuera del try para poder avisarle al chat si algo revienta más abajo:
  // sin esto, un error interno queda en silencio total del lado de la
  // persona (el 500 solo lo ve Telegram, que no reintenta para siempre).
  let chatIdForErrors: number | undefined;

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
    const rawText: string | undefined = message?.text;
    chatIdForErrors = chatId;

    if (!chatId || !rawText) {
      return NextResponse.json({ ok: true }); // otro tipo de update, ignorar
    }
    const text = rawText.trim();

    if (text === "/start") {
      await sendTelegramMessage(
        chatId,
        `¡Hola! Tu chat_id es ${chatId}.\n\nPasáselo a quien administra la app de gastos para que te active (variable TELEGRAM_CHAT_ID_PERSON_1 o _2 en Vercel). Una vez activo podés: cargar movimientos ("$15.550 verdulería"), preguntar ("cuánto gasté en comida este mes") o editar en bulk ("cambiá todos los de Su favorita de 4000 a 3000").`
      );
      return NextResponse.json({ ok: true });
    }

    const person = personForChatId(chatId);
    if (!person) {
      await sendTelegramMessage(chatId, "Todavía no estás activado para usar el bot. Mandá /start y pasale tu chat_id a quien administra la app.");
      return NextResponse.json({ ok: true });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const today = new Date().toISOString().slice(0, 10);
    const otherPerson = person === process.env.NEXT_PUBLIC_PERSON_1_NAME ? process.env.NEXT_PUBLIC_PERSON_2_NAME : process.env.NEXT_PUBLIC_PERSON_1_NAME;

    // -----------------------------------------------------------------
    // ¿Hay un bulk propuesto esperando SI/NO de este chat?
    // -----------------------------------------------------------------
    const { data: pending } = await supabase
      .from("bot_pending_actions")
      .select("*")
      .eq("chat_id", String(chatId))
      .maybeSingle();

    if (pending) {
      const ageMinutes = (Date.now() - new Date(pending.created_at).getTime()) / 60000;
      if (ageMinutes > PENDING_EXPIRY_MINUTES) {
        await supabase.from("bot_pending_actions").delete().eq("chat_id", String(chatId));
        // sigue de largo y procesa el mensaje como uno nuevo
      } else {
        const normalized = text.toLowerCase();
        // (\s|$) en vez de \b: la tilde de "sí" no cuenta como carácter de
        // palabra para JS, así que \b después de "sí" nunca matchea.
        if (/^(si|sí|dale|confirmar|confirmo|ok|listo)(\s|$)/.test(normalized)) {
          const ids = pending.transaction_ids as string[];
          if (pending.action_type === "bulk_delete") {
            await supabase.from("transactions").delete().in("id", ids);
            await sendTelegramMessage(chatId, `🗑️ Listo, borré ${ids.length} movimiento(s).`);
          } else {
            const changes = pending.changes || {};
            const patch: Record<string, any> = {};
            if (changes.amount) patch.amount = changes.amount;
            if (changes.category_id) patch.category_id = changes.category_id;
            if (changes.description) patch.description = changes.description;
            await supabase.from("transactions").update(patch).in("id", ids);
            await sendTelegramMessage(chatId, `✅ Listo, actualicé ${ids.length} movimiento(s).`);
          }
          await supabase.from("bot_pending_actions").delete().eq("chat_id", String(chatId));
          return NextResponse.json({ ok: true });
        }
        if (/^(no|cancelar|cancela)(\s|$)/.test(normalized)) {
          await supabase.from("bot_pending_actions").delete().eq("chat_id", String(chatId));
          await sendTelegramMessage(chatId, "Cancelado, no toqué nada.");
          return NextResponse.json({ ok: true });
        }
        await sendTelegramMessage(chatId, `Tenés un cambio pendiente de confirmar:\n\n${pending.summary}\n\nRespondé SI o NO.`);
        return NextResponse.json({ ok: true });
      }
    }

    // -----------------------------------------------------------------
    // Mensaje nuevo: clasificar qué quiere hacer.
    // -----------------------------------------------------------------
    const intent = await classifyIntent(text);

    if (intent === "log") {
      const parsed = await parseLog(text, today);
      if (!parsed || !parsed.amount) {
        await sendTelegramMessage(chatId, 'No pude entender un monto ahí. Probá con algo tipo "$15.550 verdulería" o "cobré 20000 changas".');
        return NextResponse.json({ ok: true });
      }
      const { data: categories } = await supabase.from("categories").select("id, name, emoji");
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
        `✅ Cargado: ${sign}${formatMoney(parsed.amount)} · ${parsed.description} · ${category?.emoji || ""} ${parsed.category_name} · ${parsed.date}\n\nSi está mal, corregilo desde la app.`
      );
      return NextResponse.json({ ok: true });
    }

    if (intent === "query") {
      const q = await parseQuery(text, today);
      if (!q) {
        await sendTelegramMessage(chatId, "No pude procesar esa pregunta, probá reformularla.");
        return NextResponse.json({ ok: true });
      }
      let dbQuery = supabase
        .from("transactions")
        .select("amount, type, category_id, paid_by")
        .gte("date", q.start_date)
        .lte("date", q.end_date);
      if (q.type !== "both") dbQuery = dbQuery.eq("type", q.type);
      if (q.person_scope === "me") dbQuery = dbQuery.eq("paid_by", person);
      else if (q.person_scope === "other" && otherPerson) dbQuery = dbQuery.eq("paid_by", otherPerson);

      const { data } = await dbQuery;
      let rows = data || [];
      const periodLabel = q.start_date === q.end_date ? q.start_date : `${q.start_date} a ${q.end_date}`;

      if (q.breakdown_by_category) {
        const { data: cats } = await supabase.from("categories").select("id, name, emoji");
        const rankType = q.type === "income" ? "income" : "expense"; // "both" rankea gastos, es el caso típico
        const byCat = new Map<string, number>();
        for (const r of rows.filter((r) => r.type === rankType)) {
          const cat = cats?.find((c) => c.id === r.category_id);
          const name = cat ? `${cat.emoji} ${cat.name}` : "🔖 Sin categoría";
          byCat.set(name, (byCat.get(name) || 0) + Number(r.amount));
        }
        const sorted = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
        const label = rankType === "income" ? "Ingresos" : "Gastos";
        const reply =
          sorted.length === 0
            ? `No encontré movimientos en ese período (${periodLabel}).`
            : `📊 ${label} por categoría (${periodLabel}):\n${sorted
                .slice(0, 5)
                .map(([name, val], i) => `${i + 1}. ${name}: ${formatMoney(val)}`)
                .join("\n")}`;
        await sendTelegramMessage(chatId, reply);
        return NextResponse.json({ ok: true });
      }

      if (q.category_name) {
        const { data: cats } = await supabase.from("categories").select("id, name").eq("name", q.category_name);
        const catId = cats?.[0]?.id;
        rows = rows.filter((r) => r.category_id === catId);
      }

      const expenseTotal = rows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);
      const incomeTotal = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
      const scopeLabel = q.category_name ? ` en ${q.category_name}` : "";

      let reply: string;
      if (q.type === "expense") {
        reply = `💸 Gastos${scopeLabel} (${periodLabel}): ${formatMoney(expenseTotal)} en ${rows.length} movimiento(s).`;
      } else if (q.type === "income") {
        reply = `💰 Ingresos${scopeLabel} (${periodLabel}): ${formatMoney(incomeTotal)} en ${rows.length} movimiento(s).`;
      } else {
        reply = `📊 ${periodLabel}${scopeLabel}:\nGastos: ${formatMoney(expenseTotal)}\nIngresos: ${formatMoney(incomeTotal)}\nBalance: ${formatMoney(incomeTotal - expenseTotal)}`;
      }
      await sendTelegramMessage(chatId, reply);
      return NextResponse.json({ ok: true });
    }

    if (intent === "bulk_edit" || intent === "bulk_delete") {
      const f = await parseBulk(text);
      if (!f || !hasRealFilter(f)) {
        await sendTelegramMessage(chatId, "Necesito algo más específico para buscar: un nombre, una categoría o un monto.");
        return NextResponse.json({ ok: true });
      }
      if (intent === "bulk_edit" && !hasRealChange(f)) {
        await sendTelegramMessage(chatId, "Encontré qué buscar, pero no qué cambiar (¿nuevo monto, categoría o descripción?).");
        return NextResponse.json({ ok: true });
      }

      const { data: categories } = await supabase.from("categories").select("id, name, emoji");
      const matches = await findBulkMatches(supabase, categories || [], f);

      if (matches.length === 0) {
        await sendTelegramMessage(chatId, "No encontré movimientos que matcheen con eso.");
        return NextResponse.json({ ok: true });
      }
      if (matches.length > MAX_BULK_MATCHES) {
        await sendTelegramMessage(chatId, `Encontré ${matches.length} movimientos, es demasiado para tocar de una. Sé más específico (nombre exacto, categoría, monto).`);
        return NextResponse.json({ ok: true });
      }

      const examples = matches
        .slice(0, 5)
        .map((m) => `· ${m.date} ${m.type === "income" ? "+" : "-"}${formatMoney(Number(m.amount))} ${m.description || ""}`)
        .join("\n");
      const more = matches.length > 5 ? `\n…y ${matches.length - 5} más.` : "";

      if (intent === "bulk_delete") {
        const summary = `Borrar ${matches.length} movimiento(s):\n${examples}${more}`;
        await supabase.from("bot_pending_actions").upsert({
          chat_id: String(chatId),
          action_type: "bulk_delete",
          transaction_ids: matches.map((m) => m.id),
          changes: null,
          summary,
        });
        await sendTelegramMessage(chatId, `🗑️ ${summary}\n\n¿Confirmás? Respondé SI o NO.`);
        return NextResponse.json({ ok: true });
      }

      const changeParts: string[] = [];
      const changes: Record<string, any> = {};
      if (f.change_amount > 0) {
        changes.amount = f.change_amount;
        changeParts.push(`monto → ${formatMoney(f.change_amount)}`);
      }
      if (f.change_category_name) {
        const cat = (categories || []).find((c) => c.name === f.change_category_name);
        if (cat) {
          changes.category_id = cat.id;
          changeParts.push(`categoría → ${cat.emoji} ${cat.name}`);
        }
      }
      if (f.change_description) {
        changes.description = f.change_description;
        changeParts.push(`descripción → "${f.change_description}"`);
      }

      const summary = `Editar ${matches.length} movimiento(s) (${changeParts.join(", ")}):\n${examples}${more}`;
      await supabase.from("bot_pending_actions").upsert({
        chat_id: String(chatId),
        action_type: "bulk_edit",
        transaction_ids: matches.map((m) => m.id),
        changes,
        summary,
      });
      await sendTelegramMessage(chatId, `✏️ ${summary}\n\n¿Confirmás? Respondé SI o NO.`);
      return NextResponse.json({ ok: true });
    }

    // intent === "unclear"
    await sendTelegramMessage(
      chatId,
      'No entendí. Podés: cargar un movimiento ("$15.550 verdulería"), preguntar ("cuánto gasté en comida este mes") o editar en bulk ("cambiá todos los de Su favorita de 4000 a 3000").'
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    if (chatIdForErrors) {
      await sendTelegramMessage(chatIdForErrors, "⚠️ Algo falló procesando tu mensaje. Probá de nuevo en un rato.").catch(() => {});
    }
    return NextResponse.json({ error: err?.message || "Error inesperado." }, { status: 500 });
  }
}
