"use client";

import { useState } from "react";
import { Category, Transaction } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import EditTransactionModal from "@/components/EditTransactionModal";

export default function TransactionList({
  transactions,
  categoryById,
  categories = [],
  emptyLabel = "Todavía no hay movimientos cargados.",
  onChanged,
}: {
  transactions: Transaction[];
  categoryById: Record<number, Category>;
  categories?: Category[];
  emptyLabel?: string;
  onChanged?: () => void;
}) {
  const [editing, setEditing] = useState<Transaction | null>(null);

  if (transactions.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">{emptyLabel}</p>;
  }

  return (
    <>
      <ul className="divide-y divide-gray-100">
        {transactions.map((t) => {
          const cat = t.category_id ? categoryById[t.category_id] : undefined;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setEditing(t)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left active:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cat?.emoji || "🔖"}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {t.description || cat?.name || "Movimiento"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t.source === "ai_email" && <span title="Cargado por mail">📧 </span>}
                      {new Date(t.date + "T00:00:00").toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                      })}{" "}
                      · {t.paid_by}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    t.type === "income" ? "text-brand-600" : "text-gray-900"
                  }`}
                >
                  {t.type === "income" ? "+" : "-"}
                  {formatMoney(Number(t.amount))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {editing && (
        <EditTransactionModal
          transaction={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}
    </>
  );
}
