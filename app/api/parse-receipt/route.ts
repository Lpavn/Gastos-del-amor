import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const categoryNames = DEFAULT_CATEGORIES.map((c) => c.name);

// Esquema exacto que le pedimos a Gemini que devuelva (JSON mode / structured
// output). Al pasarlo como responseSchema, el modelo está obligado a
// devolver siempre este formato, no texto libre, así no hay que parsear nada.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transactions: {
      type: Type.ARRAY,
      description:
        "Un elemento por cada movimiento encontrado. Si es un ticket de compra con varios productos (por ejemplo supermercado, farmacia, kiosco), DESGLOSÁ cada producto/línea del ticket en un elemento separado, con su propio nombre y precio — no sumes todo en un único total. Si es un comprobante de un solo consumo (ej: una transferencia, una factura de servicio) usá un solo elemento con el total. Si es una captura de movimientos bancarios, un elemento por cada línea/movimiento.",
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
            description: "expense si es un gasto/compra/débito, income si es un ingreso/acreditación/sueldo.",
          },
          amount: {
            type: Type.NUMBER,
            description: "Monto total en valor absoluto (positivo), sin símbolo de moneda.",
          },
          description: {
            type: Type.STRING,
            description:
              "Descripción breve. Si es un ítem desglosado de un ticket, el nombre del producto (ej: 'Leche La Serenísima 1L'). Si es un movimiento único, el comercio o concepto (ej: 'Coto', 'Transferencia a Juan').",
          },
          category_name: {
            type: Type.STRING,
            enum: categoryNames,
            description: "La categoría más adecuada de la lista permitida.",
          },
          confidence: {
            type: Type.STRING,
            enum: ["alta", "media", "baja"],
            description: "Qué tan seguro estás de los datos extraídos (imagen borrosa, monto ambiguo, etc. baja/media).",
          },
        },
        required: ["date", "type", "amount", "description", "category_name", "confidence"],
      },
    },
  },
  required: ["transactions"],
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta configurar GEMINI_API_KEY en el servidor." },
        { status: 500 }
      );
    }

    const { image, mimeType } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "Falta la imagen." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toISOString().slice(0, 10);

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mimeType || "image/jpeg", data: image } },
            {
              text: `Hoy es ${today}. Analizá esta foto: puede ser un ticket/factura de compra, un comprobante de transferencia, o una captura de pantalla con una lista de movimientos bancarios. Extraé todos los movimientos de dinero que encuentres. Si es un ticket de compra con varios productos (por ejemplo un ticket de supermercado), NO lo resumas en un solo gasto: desglosá cada producto como un movimiento individual, usando el nombre del producto como descripción y su precio como monto. Ignorá líneas que no sean productos (subtotal, IVA, "total", vuelto, etc.), esas no van como movimientos aparte. Categorías permitidas: ${categoryNames.join(", ")}. Si un dato no está claro, hacé la mejor estimación posible y marcá confidence "baja".`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: "La IA no pudo leer la imagen. Probá con otra foto o cargá el movimiento a mano." },
        { status: 422 }
      );
    }

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado al procesar la imagen." },
      { status: 500 }
    );
  }
}
