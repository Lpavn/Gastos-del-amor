// Normaliza el texto que identifica a una contraparte (alias, comercio o
// CBU/CVU) para poder compararlo de forma consistente entre mails/compras
// distintas del mismo origen.
//
// Caso comercio (ej. "EL PUENTE SA SUC 0245 Nro Op 88213456"): sacamos los
// números, porque son sucursal/fecha/operación — la parte que cambia en
// cada compra al MISMO comercio, y por eso una comparación exacta con ellos
// adentro nunca vuelve a matchear la próxima vez.
//
// Caso CBU/CVU (una transferencia a un número de cuenta, sin alias con
// nombre — ej. transferir al "supermercado chino" de la esquina que no
// tiene alias): ahí el número ES el identificador fijo, no ruido variable
// de la transacción, así que si sacáramos los dígitos quedaría vacío y
// tampoco matchearía nunca. Un texto que es solo dígitos (con o sin
// espacios/puntos/guiones de formato) se detecta como CBU/CVU y se
// conserva completo.
export function normalizeMerchantKey(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const digitsOnly = trimmed.replace(/[\s.\-]/g, "");
  if (/^[0-9]{6,}$/.test(digitsOnly)) return digitsOnly;

  return trimmed
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/[*#()/_.,:;\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
