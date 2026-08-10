export type TransactionType = "expense" | "income";

export interface Category {
  id: number;
  name: string;
  emoji: string;
  kind: "expense" | "income" | "both";
}

export interface Transaction {
  id: string;
  created_at: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  amount: number;
  description: string;
  category_id: number | null;
  paid_by: string;
  receipt_url: string | null;
  source: "manual" | "ai_receipt" | "ai_email";
  merchant_key: string | null; // alias/comercio tal cual lo extrajo la IA del mail (para autocategorizar)
}

// Regla "este alias/comercio siempre va a esta categoría", usada por
// /api/import-email para no volver a caer en "Otros" en mails repetidos.
export interface CategoryRule {
  id: number;
  match_key: string;
  category_id: number;
  display_name: string | null; // nombre personalizado (ej. "Empanadas") para futuros movimientos
  created_at: string;
}

// Forma de un movimiento tal como lo devuelve la IA antes de guardarlo
// (todavía no tiene id, se puede editar en la pantalla de revisión)
export interface DraftTransaction {
  date: string;
  type: TransactionType;
  amount: number;
  description: string;
  category_name: string;
  paid_by: string;
  confidence: "alta" | "media" | "baja";
}
