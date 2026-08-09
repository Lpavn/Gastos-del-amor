import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { normalizeMerchantKey } from "@/lib/merchantKey";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const categoryNames = DEFAULT_CATEGORIES.map((c) => c.name);

// Mismo criterio que parse-receipt, pero para texto de mail en vez de foto.
// Además le pedimos a la IA que nos diga si el mail describe realmente un
// movimiento de dinero, porque no todos los mails etiquetados lo son
// (publicidad, resúmenes sin montos puntuales, avisos genéricos, etc.).
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_movement: {
      type: Type.BOOLEAN,
      description:
        "true si el mail describe un movimiento de dinero real (compra, pago, transferencia, acreditación). false si es publicidad, un resumen sin montos puntuales, o cualquier mail que no corresponda cargar.",
    },
    transactions: {
      type: Type.ARRAY,
      description:
        "Un elemento por cada movimiento que encuentres en el mail. Casi siempre es uno solo. Si is_movement es false, devolver un array vacío.",
      items: {
        type: Type.OBJECT,
        properties: {
          date: {
            type: Type.STRING,
            description: "Fecha del movimiento en formato YYYY-MM-DD. Si no aparece, usar la fecha de hoy.",
          },
          type: {
            type: Type.STRING,
            enum: ["expense", "income"],
            description: "expense si es un gasto/compra/débito, income si es un ingreso/acreditación.",
          },
          amount: {
            type: Type.NUMBER,
            description: "Monto total en valor absoluto (positivo), sin símbolo de moneda.",
          },
          description: {
            type: Type.STRING,
            description: "Descripción breve: comercio, concepto o detalle del movimiento.",
          },
          category_name: {
            type: Type.STRING,
            enum: categoryNames,
            description: "La categoría más adecuada de la lista permitida.",
          },
          merchant_key: {
            type: Type.STRING,
            description:
              "El nombre del comercio o el alias/destinatario de la transferencia, copiado LITERAL del mail (no lo resumas ni lo traduzcas). Por ejemplo el valor exacto que aparece después de 'Comercio:' o 'Alias:' o el nombre de la persona/cuenta destino. Si el mail no lo menciona, dejalo vacío.",
          },
        },
        required: ["date", "type", "amount", "description", "category_name", "merchant_key"],
      },
    },
  },
  required: ["is_movement", "transactions"],
};

export async function POST(req: NextRequest) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const importSecret = process.env.IMPORT_SECRET;

    if (!geminiKey || !supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Falta configurar GEMINI_API_KEY / NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en el servidor." },
        { status: 500 }
      );
    }
    if (!importSecret) {
      return NextResponse.json(
        { error: "Falta configurar IMPORT_SECRET en el servidor." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    const { secret, subject, from, text, person } = body as {
      secret?: string;
      subject?: string;
      from?: string;
      text?: string;
      person?: string;
    };

    if (secret !== importSecret) {
      return NextResponse.json({ error: "Secreto inválido." }, { status: 401 });
    }
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Falta el texto del mail." }, { status: 400 });
    }

    const paidBy = (person && person.trim()) || process.env.EMAIL_IMPORT_PERSON || "";
    if (!paidBy) {
      return NextResponse.json(
        { error: "No se pudo determinar a quién asignar el movimiento (person / EMAIL_IMPORT_PERSON)." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const today = new Date().toISOString().slice(0, 10);

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Hoy es ${today}. Este es un mail de notificación de un banco o billetera virtual.\nAsunto: ${subject || "(sin asunto)"}\nDe: ${from || "(desconocido)"}\n\nTexto del mail:\n"""\n${text.slice(0, 6000)}\n"""\n\nAnalizalo y extraé el o los movimientos de dinero que describe (compra, pago, transferencia, acreditación). Si el mail NO describe ningún movimiento real (publicidad, resumen sin montos puntuales, aviso genérico, etc.), respondé is_movement=false y transactions vacío. Categorías permitidas: ${categoryNames.join(", ")}.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json({ error: "La IA no pudo leer el mail." }, { status: 422 });
    }

    const parsed = JSON.parse(responseText);
    if (!parsed.is_movement || !Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
      return NextResponse.json({ imported: 0, skipped: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("id, name");
    if (catError) {
      return NextResponse.json({ error: catError.message }, { status: 500 });
    }
    const categoryIdFor = (name: string) =>
      categories?.find((c) => c.name === name)?.id ?? null;

    // Reglas manuales: "todo movimiento con este alias/comercio va siempre a
    // esta categoría" (se cargan editando un movimiento en la app). Si el
    // mail matchea una regla, pisa lo que haya decidido la IA.
    const { data: rules, error: rulesError } = await supabase
      .from("category_rules")
      .select("match_key, category_id");
    if (rulesError) {
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }
    const categoryIdForRule = (merchantKey: string) => {
      const normalized = normalizeMerchantKey(merchantKey);
      if (!normalized) return null;
      return rules?.find((r) => r.match_key === normalized)?.category_id ?? null;
    };

    const rows = parsed.transactions.map((t: any) => {
      const merchantKey: string = t.merchant_key || "";
      const ruleCategoryId = categoryIdForRule(merchantKey);
      return {
        date: t.date,
        type: t.type,
        amount: t.amount,
        description: t.description,
        category_id: ruleCategoryId ?? categoryIdFor(t.category_name),
        paid_by: paidBy,
        source: "ai_email" as const,
        merchant_key: normalizeMerchantKey(merchantKey) || null,
      };
    });

    const { error } = await supabase.from("transactions").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ imported: rows.length });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado al procesar el mail." },
      { status: 500 }
    );
  }
}
