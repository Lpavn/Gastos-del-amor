"use client";

import { useMemo, useState } from "react";
import { useTransactions } from "@/lib/useTransactions";
import TransactionList from "@/components/TransactionList";
import { formatMoney } from "@/lib/format";
import { getPeriodRange, shiftPeriod, formatPeriodLabel, isInRange, PeriodMode } from "@/lib/period";
import { PERSON_1, PERSON_2 } from "@/lib/person";
import { Category, Transaction } from "@/lib/types";

const MODE_LABEL: Record<PeriodMode, string> = {
  week: "Semana",
  month: "Mes",
  year: "Año",
};

type TypeFilter = "all" | "expense" | "income";
type PersonFilter = "all" | string;

// Para conciliar contra el resumen del banco (ej. un excel exportado del
// home banking): un CSV con lo que ya está cargado en la app, para
// comparar fecha a fecha y monto a monto.
function exportCsv(transactions: Transaction[], categoryById: Record<number, Category>) {
  const header = ["fecha", "tipo", "monto", "descripcion", "categoria", "pagado_por"];
  const rows = transactions.map((t) => [
    t.date,
    t.type,
    String(t.amount),
    t.description,
    (t.category_id ? categoryById[t.category_id]?.name : "") || "",
    t.paid_by,
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `movimientos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MovimientosPage() {
  const { transactions, categories, categoryById, loading, refresh } = useTransactions();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [personFilter, setPersonFilter] = useState<PersonFilter>("all");

  const { start, end } = useMemo(() => getPeriodRange(mode, anchor), [mode, anchor]);

  const periodTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          isInRange(t.date, start, end) &&
          (typeFilter === "all" || t.type === typeFilter) &&
          (personFilter === "all" || t.paid_by === personFilter)
      ),
    [transactions, start, end, typeFilter, personFilter]
  );

  const totalExpense = periodTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = periodTransactions
    .filter((t) => t.type === "income")
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

      <div className="mb-3 flex w-fit rounded-full bg-gray-100 p-1 text-sm font-medium">
        {([
          ["all", "Todos"],
          ["expense", "Gastos"],
          ["income", "Ingresos"],
        ] as [TypeFilter, string][]).map(([tf, label]) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTypeFilter(tf)}
            className={`rounded-full px-3 py-1 ${
              typeFilter === tf ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex w-fit rounded-full bg-gray-100 p-1 text-sm font-medium">
        {([
          ["all", "Todos"],
          [PERSON_1, PERSON_1],
          [PERSON_2, PERSON_2],
        ] as [PersonFilter, string][]).map(([pf, label]) => (
          <button
            key={pf}
            type="button"
            onClick={() => setPersonFilter(pf)}
            className={`rounded-full px-3 py-1 ${
              personFilter === pf ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
            }`}
          >
            {label}
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
        <span className="font-semibold text-gray-900">
          {typeFilter !== "income" && `Gastos: ${formatMoney(totalExpense)}`}
          {typeFilter === "all" && "  ·  "}
          {typeFilter !== "expense" && `Ingresos: ${formatMoney(totalIncome)}`}
        </span>
      </div>

      <button
        type="button"
        onClick={() => exportCsv(periodTransactions, categoryById)}
        disabled={periodTransactions.length === 0}
        className="mb-3 w-full rounded-xl bg-white py-2 text-sm font-medium text-brand-600 shadow-sm disabled:opacity-50"
      >
        ⬇️ Exportar CSV ({MODE_LABEL[mode].toLowerCase()} actual)
      </button>

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
