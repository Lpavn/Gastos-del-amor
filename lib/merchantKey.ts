// Normaliza el texto que identifica a una contraparte (alias, comercio) para
// poder compararlo de forma consistente entre mails distintos del mismo
// origen: sin mayúsculas, sin espacios repetidos ni al borde.
export function normalizeMerchantKey(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}
