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
            description:
              "Monto total en valor absoluto (positivo), sin símbolo de moneda, en la moneda indicada en 'currency'. Si es una línea de un resumen de tarjeta de crédito en dólares u otra moneda extranjera y el resumen TAMBIÉN muestra el equivalente ya convertido a pesos para esa misma línea (ej. 'U$S 1,99' y al lado o abajo '$ 2.150,00'), usá ese monto en pesos y marcá currency ARS. Si la línea está en dólares y el resumen NO muestra un equivalente en pesos para ella (solo aparece el monto en U$S), usá el monto en dólares tal cual y marcá currency USD — no inventes ni estimes una conversión.",
          },
          currency: {
            type: Type.STRING,
            enum: ["ARS", "USD"],
            description:
              "Moneda del campo 'amount'. ARS para pesos (el caso normal, y también cuando una línea en dólares ya trae su equivalente en pesos en el resumen). USD solo cuando la línea está expresada en dólares y el resumen no da un equivalente en pesos para esa línea puntual.",
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
          merchant_key: {
            type: Type.STRING,
            description:
              "El alias, CBU o nombre que identifica a la CONTRAPARTE de una transferencia, o el nombre del comercio, copiado LITERAL de la imagen (no lo resumas). Se usa para detectar si este movimiento ya está cargado. Aplica sobre todo a capturas de una lista de movimientos bancarios (cada línea suele mostrar el alias/CBU o comercio). Si es un ítem desglosado de un ticket de supermercado/farmacia, o la imagen no muestra ese dato, dejalo vacío.",
          },
        },
        required: ["date", "type", "amount", "currency", "description", "category_name", "confidence", "merchant_key"],
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
      return NextResponse.json({ error: "Falta la imagen o el PDF." }, { status: 400 });
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
              text: `Hoy es ${today}. Analizá este archivo (puede ser una foto o un PDF): puede ser un ticket/factura de compra, un comprobante de transferencia, una captura de pantalla con una lista de movimientos bancarios, o el resumen de una tarjeta de crédito (foto o PDF descargado, de una o varias páginas). Extraé todos los movimientos de dinero que encuentres. Si es un ticket de compra con varios productos (por ejemplo un ticket de supermercado), NO lo resumas en un solo gasto: desglosá cada producto como un movimiento individual, usando el nombre del producto como descripción y su precio como monto. Ignorá líneas que no sean productos (subtotal, IVA, "total", vuelto, etc.), esas no van como movimientos aparte. Si es un resumen de tarjeta de crédito, desglosá cada consumo/línea del resumen como un movimiento individual (fecha, comercio, monto), recorriendo TODAS las páginas del PDF si tiene más de una, ignorando líneas de "saldo anterior", "pago realizado", "intereses" salvo que sean un cargo real. Para cada línea en dólares u otra moneda extranjera: si el resumen muestra el equivalente ya convertido a pesos para esa línea, usá ese monto en pesos (currency ARS); si la línea SOLO muestra el monto en dólares sin conversión a pesos (caso común: Santander no siempre da el equivalente por línea), usá el monto en dólares tal cual y marcá currency USD — no lo inventes ni lo dejes afuera. Categorías permitidas: ${categoryNames.join(", ")}. Si un dato no está claro, hacé la mejor estimación posible y marcá confidence "baja".`,
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
