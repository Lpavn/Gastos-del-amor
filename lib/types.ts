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
  source: "manual" | "ai_receipt";
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
