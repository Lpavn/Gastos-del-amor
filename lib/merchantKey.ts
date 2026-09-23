// Normaliza el texto que identifica a una contraparte (alias, comercio) para
// poder compararlo de forma consistente entre mails/compras distintas del
// mismo origen: sin mayúsculas, sin números (fecha, monto, sucursal, número
// de operación — la parte que cambia entre compras al MISMO comercio, y por
// eso una comparación exacta con ellos adentro nunca vuelve a matchear), sin
// puntuación suelta ni espacios repetidos.
export function normalizeMerchantKey(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/[*#()/_.,:;\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
