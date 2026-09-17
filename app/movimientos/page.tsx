"use client";

import { useMemo, useState } from "react";
import { useTransactions } from "@/lib/useTransactions";
import TransactionList from "@/components/TransactionList";
import { formatMoney } from "@/lib/format";
import { getPeriodRange, shiftPeriod, formatPeriodLabel, isInRange, PeriodMode } from "@/lib/period";

const MODE_LABEL: Record<PeriodMode, string> = {
  week: "Semana",
  month: "Mes",
  year: "Año",
};

export default function MovimientosPage() {
  const { transactions, categories, categoryById, loading, refresh } = useTransactions();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [anchor, setAnchor] = useState(new Date());

  const { start, end } = useMemo(() => getPeriodRange(mode, anchor), [mode, anchor]);

  const periodTransactions = useMemo(
    () => transactions.filter((t) => isInRange(t.date, start, end)),
    [transactions, start, end]
  );

  const totalExpense = periodTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const isCurrentPeriod = useMemo(() => {
    const now = getPeriodRange(mode, new Date());
    return now.start.getTime() === start.getTime() && now.end.getTime() === end.getTime();
  }, [mode, start, end]);

  if (loading) {
    return (
      <div className="px-4 pt-6">
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Historial</h1>

      <div className="mb-3 flex w-fit rounded-full bg-gray-100 p-1 text-sm font-medium">
        {(["week", "month", "year"] as PeriodMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 ${
              mode === m ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
            }`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white px-2 py-2 shadow-sm">
        <button
          type="button"
          onClick={() => setAnchor(shiftPeriod(mode, anchor, -1))}
          className="px-3 py-1 text-lg text-gray-400 active:text-gray-600"
          aria-label="Período anterior"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize text-gray-900">{formatPeriodLabel(mode, anchor)}</p>
          {!isCurrentPeriod && (
            <button
              type="button"
              onClick={() => setAnchor(new Date())}
              className="text-xs font-medium text-brand-600"
            >
              Volver a hoy
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAnchor(shiftPeriod(mode, anchor, 1))}
          className="px-3 py-1 text-lg text-gray-400 active:text-gray-600"
          aria-label="Período siguiente"
        >
          ›
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {periodTransactions.length} movimiento{periodTransactions.length !== 1 ? "s" : ""}
        </span>
        <span className="font-semibold text-gray-900">Gastos: {formatMoney(totalExpense)}</span>
      </div>

      <div className="rounded-2xl bg-white px-4 shadow-sm">
        <TransactionList
          transactions={periodTransactions}
          categoryById={categoryById}
          categories={categories}
          onChanged={refresh}
          emptyLabel="No hay movimientos en este período."
        />
      </div>
    </div>
  );
}
