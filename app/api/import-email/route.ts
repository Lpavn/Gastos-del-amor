import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { normalizeMerchantKey } from "@/lib/merchantKey";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const categoryNames = DEFAULT_CATEGORIES.map((c) => c.name);

// Alias/CBU propios de la pareja (ver env INTERNAL_TRANSFER_ALIASES). Una
// transferencia hacia o desde cualquiera de estos valores es plata que se
// mueve ENTRE Luca y Kiara, no un movimiento real de la pareja como unidad
// (no es ni un gasto ni un ingreso), así que no se guarda.
// Comparación laxa: solo letras/números en minúscula, para no fallar por
// espacios o guiones distintos en cómo cada mail escribe el mismo CBU/alias.
function normalizeAliasForMatch(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const internalTransferAliases = new Set(
  (process.env.INTERNAL_TRANSFER_ALIASES || "")
    .split(",")
    .map((a) => normalizeAliasForMatch(a))
    .filter(Boolean)
);

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
            description:
              "expense si es dinero que SALE (compra, pago, transferencia enviada/debitada). income si es dinero que ENTRA (transferencia recibida, acreditación, depósito). Prestá especial atención a las transferencias: 'recibiste una transferencia', 'te transfirieron', 'te acreditamos', 'depósito recibido', 'acreditación' => income. 'Enviaste una transferencia', 'transferiste', 'realizaste un pago', 'débito', 'compra' => expense. No asumas expense por default: si el mail dice claramente que la plata entró a la cuenta, es income.",
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
              "El alias, CBU o nombre que identifica a la CONTRAPARTE de la transferencia, o el nombre del comercio en una compra, copiado LITERAL del mail (no lo resumas ni lo traduzcas). Si es una transferencia ENVIADA: el alias/CBU/nombre del destinatario (después de 'Alias:', 'Para:', 'Destino:'). Si es una transferencia RECIBIDA: el alias/CBU/nombre de quien la envió (después de 'De:', 'Origen:', 'Remitente:'). Si es una compra: el nombre del comercio. Si el mail no lo menciona, dejalo vacío.",
          },
          is_credit_card_bill_payment: {
            type: Type.BOOLEAN,
            description:
              "true SOLO si el movimiento es el débito/pago del RESUMEN/SALDO TOTAL de una tarjeta de crédito (ej. 'débito automático por el pago total de tu resumen', 'pago de tu tarjeta terminada en 1234'). false para una compra puntual hecha CON la tarjeta (esa sí es un gasto normal). Un mail que solo AVISA que el resumen 'vence pronto' sin haberse debitado todavía no es un movimiento real: en ese caso is_movement debe ser false y este campo no importa.",
          },
        },
        required: ["date", "type", "amount", "description", "category_name", "merchant_key", "is_credit_card_bill_payment"],
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
              text: `Hoy es ${today}. Este es un mail de notificación de un banco o billetera virtual.\nAsunto: ${subject || "(sin asunto)"}\nDe: ${from || "(desconocido)"}\n\nTexto del mail:\n"""\n${text.slice(0, 6000)}\n"""\n\nAnalizalo y extraé el o los movimientos de dinero que describe (compra, pago, transferencia enviada o recibida, acreditación). Si el mail NO describe ningún movimiento real ya ocurrido (publicidad, recordatorio de que algo "vence pronto" pero todavía no se debitó, resumen sin montos puntuales, aviso genérico, etc.), respondé is_movement=false y transactions vacío.\n\nOjo con la dirección de la plata: una transferencia RECIBIDA es income (entra plata), una transferencia ENVIADA es expense (sale plata). No lo confundas solo porque el mail es de un banco. Categorías permitidas: ${categoryNames.join(", ")}.`,
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
    // esta categoría (y opcionalmente se muestra con este nombre)" (se cargan
    // editando un movimiento en la app). Si el mail matchea una regla, pisa
    // lo que haya decidido la IA.
    const { data: rules, error: rulesError } = await supabase
      .from("category_rules")
      .select("match_key, category_id, display_name");
    if (rulesError) {
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }
    const ruleFor = (merchantKey: string) => {
      const normalized = normalizeMerchantKey(merchantKey);
      if (!normalized) return null;
      return rules?.find((r) => r.match_key === normalized) ?? null;
    };

    let skippedInternalTransfer = 0;
    let skippedCardBillPayment = 0;

    const rows = parsed.transactions
      .filter((t: any) => {
        if (internalTransferAliases.has(normalizeAliasForMatch(t.merchant_key))) {
          skippedInternalTransfer++;
          return false;
        }
        if (t.is_credit_card_bill_payment) {
          skippedCardBillPayment++;
          return false;
        }
        return true;
      })
      .map((t: any) => {
        const merchantKey: string = t.merchant_key || "";
        const rule = ruleFor(merchantKey);
        return {
          date: t.date,
          type: t.type,
          amount: t.amount,
          description: rule?.display_name || t.description,
          category_id: rule?.category_id ?? categoryIdFor(t.category_name),
          paid_by: paidBy,
          source: "ai_email" as const,
          merchant_key: normalizeMerchantKey(merchantKey) || null,
        };
      });

    if (rows.length === 0) {
      return NextResponse.json({
        imported: 0,
        skippedInternalTransfer,
        skippedCardBillPayment,
      });
    }

    const { error } = await supabase.from("transactions").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      imported: rows.length,
      skippedInternalTransfer,
      skippedCardBillPayment,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado al procesar el mail." },
      { status: 500 }
    );
  }
}
