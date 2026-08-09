import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Le pedimos a Gemini un JSON con esta forma exacta (structured output), así
// no hay que parsear texto libre — mismo patrón que /api/parse-receipt en
// Gastos del Amor, aplicado acá a cargar productos de un menú.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "Nombre corto del plato o producto, tal como iría en una carta.",
    },
    description: {
      type: Type.STRING,
      description: "Descripción breve (ingredientes o detalle), o cadena vacía si no se puede inferir.",
    },
    price: {
      type: Type.NUMBER,
      description: "Precio en números, sin símbolo de moneda. 0 si no aparece ningún precio en la imagen.",
    },
    category_name: {
      type: Type.STRING,
      description: "La categoría más adecuada de la lista permitida que se pasó en el prompt.",
    },
  },
  required: ["name", "description", "price", "category_name"],
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

    const { image, mimeType, categoryNames } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "Falta la imagen." }, { status: 400 });
    }

    const categories: string[] = Array.isArray(categoryNames) && categoryNames.length
      ? categoryNames
      : ["Entradas", "Platos principales", "Bebidas", "Postres"];

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mimeType || "image/jpeg", data: image } },
            {
              text: `Esta foto muestra un plato de comida, una bebida, o una página de una carta/menú impreso. Extraé los datos para cargarlo como producto de un menú digital: nombre, una descripción corta, el precio si se ve en la imagen (si no se ve, poné 0), y la categoría más adecuada de esta lista: ${categories.join(", ")}. Si es la foto de un plato preparado (no de un menú impreso), inferí un nombre apetitoso y una descripción breve en base a lo que se ve.`,
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
        { error: "La IA no pudo leer la imagen. Probá con otra foto o cargá el producto a mano." },
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
