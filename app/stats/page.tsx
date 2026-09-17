"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useTransactions } from "@/lib/useTransactions";
import { formatMoney } from "@/lib/format";
import TransactionList from "@/components/TransactionList";
import { getPeriodRange, shiftPeriod, formatPeriodLabel, isInRange } from "@/lib/period";
import { PERSON_1, PERSON_2 } from "@/lib/person";

const COLORS = [
  "#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4338ca",
];

type RangeMode = "week" | "month" | "year";
type TypeFilter = "expense" | "income";
type PersonFilter = "all" | string;

export default function StatsPage() {
  const { transactions, categories, categoryById, loading, refresh } = useTransactions();
  const [rangeMode, setRangeMode] = useState<RangeMode>("month");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("expense");
  const [personFilter, setPersonFilter] = useState<PersonFilter>("all");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [weekAnchor, setWeekAnchor] = useState(now);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = transactions;
    if (rangeMode === "week") {
      const { start, end } = getPeriodRange("week", weekAnchor);
      list = list.filter((t) => isInRange(t.date, start, end));
    } else {
      list = list.filter((t) => {
        const d = new Date(t.date + "T00:00:00");
        if (d.getFullYear() !== year) return false;
        if (rangeMode === "month" && d.getMonth() !== month) return false;
        return true;
      });
    }
    if (personFilter !== "all") list = list.filter((t) => t.paid_by === personFilter);
    return list;
  }, [transactions, year, month, weekAnchor, rangeMode, personFilter]);

  // Si cambiamos de período, tipo (gasto/ingreso), persona o la categoría
  // seleccionada ya no tiene datos ahí, cerramos el detalle en vez de dejarlo
  // mostrando datos viejos.
  useEffect(() => {
    setSelectedCategory(null);
  }, [rangeMode, year, month, weekAnchor, typeFilter, personFilter]);

  const expenses = filtered.filter((t) => t.type === "expense");
  const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = filtered
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);

  const typeItems = filtered.filter((t) => t.type === typeFilter);
  const totalForType = typeFilter === "expense" ? totalExpense : totalIncome;

  const byCategory = useMemo(() => {
    const map = new Map<string, { id: number | null; name: string; value: number }>();
    for (const t of typeItems) {
      const cat = t.category_id ? categoryById[t.category_id] : undefined;
      const key = cat ? String(cat.id) : "none";
      const name = cat?.name || "Sin categoría";
      const prev = map.get(key);
      if (prev) prev.value += Number(t.amount);
      else map.set(key, { id: cat?.id ?? null, name, value: Number(t.amount) });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [typeItems, categoryById]);

  const categoryTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return typeItems.filter((t) => {
      const name = t.category_id ? categoryById[t.category_id]?.name : "Sin categoría";
      return (name || "Sin categoría") === selectedCategory;
    });
  }, [typeItems, categoryById, selectedCategory]);

  const byMonth = useMemo(() => {
    if (rangeMode !== "year") return [];
    const map = new Map<number, number>();
    for (const t of transactions.filter(
      (t) => t.type === typeFilter && (personFilter === "all" || t.paid_by === personFilter)
    )) {
      const d = new Date(t.date + "T00:00:00");
      if (d.getFullYear() !== year) continue;
      map.set(d.getMonth(), (map.get(d.getMonth()) || 0) + Number(t.amount));
    }
    const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return labels.map((label, i) => ({ label, total: map.get(i) || 0 }));
  }, [transactions, year, rangeMode, typeFilter, personFilter]);

  const typeLabel = typeFilter === "expense" ? "Gastos" : "Ingresos";

  const monthLabels = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  if (loading) {
    return <div className="px-4 pt-6"><div className="h-40 animate-pulse rounded-2xl bg-gray-200" /></div>;
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Estadísticas</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex rounded-full bg-gray-100 p-1 text-sm font-medium">
          <button
            onClick={() => setRangeMode("week")}
            className={`rounded-full px-3 py-1 ${rangeMode === "week" ? "bg-white shadow-sm text-brand-700" : "text-gray-500"}`}
          >
            Semana
          </button>
          <button
            onClick={() => setRangeMode("month")}
            className={`rounded-full px-3 py-1 ${rangeMode === "month" ? "bg-white shadow-sm text-brand-700" : "text-gray-500"}`}
          >
            Mes
          </button>
          <button
            onClick={() => setRangeMode("year")}
            className={`rounded-full px-3 py-1 ${rangeMode === "year" ? "bg-white shadow-sm text-brand-700" : "text-gray-500"}`}
          >
            Año
          </button>
        </div>

        {rangeMode === "week" && (
          <div className="flex items-center gap-1 rounded-full bg-white px-1 shadow-sm">
            <button
              onClick={() => setWeekAnchor(shiftPeriod("week", weekAnchor, -1))}
              className="px-2 py-1 text-gray-400 active:text-gray-600"
              aria-label="Semana anterior"
            >
              ‹
            </button>
            <span className="px-1 text-sm font-medium text-gray-700">
              {formatPeriodLabel("week", weekAnchor)}
            </span>
            <button
              onClick={() => setWeekAnchor(shiftPeriod("week", weekAnchor, 1))}
              className="px-2 py-1 text-gray-400 active:text-gray-600"
              aria-label="Semana siguiente"
            >
              ›
            </button>
          </div>
        )}

        {rangeMode === "month" && (
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm"
          >
            {monthLabels.map((l, i) => (
              <option key={l} value={i}>{l}</option>
            ))}
          </select>
        )}

        {rangeMode !== "week" && (
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-4 flex w-fit rounded-full bg-gray-100 p-1 text-sm font-medium">
        <button
          onClick={() => setTypeFilter("expense")}
          className={`rounded-full px-3 py-1 ${typeFilter === "expense" ? "bg-white shadow-sm text-brand-700" : "text-gray-500"}`}
        >
          Gastos
        </button>
        <button
          onClick={() => setTypeFilter("income")}
          className={`rounded-full px-3 py-1 ${typeFilter === "income" ? "bg-white shadow-sm text-brand-700" : "text-gray-500"}`}
        >
          Ingresos
        </button>
      </div>

      <div className="mb-4 flex w-fit rounded-full bg-gray-100 p-1 text-sm font-medium">
        {([
          ["all", "Todos"],
          [PERSON_1, PERSON_1],
          [PERSON_2, PERSON_2],
        ] as [PersonFilter, string][]).map(([pf, label]) => (
          <button
            key={pf}
            onClick={() => setPersonFilter(pf)}
            className={`rounded-full px-3 py-1 ${personFilter === pf ? "bg-white shadow-sm text-brand-700" : "text-gray-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-xs text-gray-400">Gastos</p>
          <p className="text-lg font-bold text-gray-900">{formatMoney(totalExpense)}</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-xs text-gray-400">Ingresos</p>
          <p className="text-lg font-bold text-brand-600">{formatMoney(totalIncome)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">{typeLabel} por categoría</h2>
        {byCategory.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            Sin {typeFilter === "expense" ? "gastos" : "ingresos"} en este período.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {byCategory.map((c, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                      opacity={!selectedCategory || selectedCategory === c.name ? 1 : 0.35}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedCategory(c.name === selectedCategory ? null : c.name)}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 flex flex-col gap-1">
              {byCategory.map((c, i) => (
                <li key={c.name}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(c.name === selectedCategory ? null : c.name)}
                    className="flex w-full items-center justify-between rounded-lg py-1 text-sm active:bg-gray-50"
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {c.name}
                    </span>
                    <span className="font-medium text-gray-700">
                      {formatMoney(c.value)} · {((c.value / totalForType) * 100).toFixed(0)}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {selectedCategory && (
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              {selectedCategory} · {formatMoney(categoryTransactions.reduce((s, t) => s + Number(t.amount), 0))}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="px-2 text-sm text-gray-400 active:text-gray-600"
            >
              ✕
            </button>
          </div>
          <TransactionList
            transactions={categoryTransactions}
            categoryById={categoryById}
            categories={categories}
            onChanged={refresh}
          />
        </div>
      )}

      {rangeMode === "year" && (
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">{typeLabel} por mes ({year})</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} width={40} />
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Bar dataKey="total" fill={typeFilter === "expense" ? "#16a34a" : "#2563eb"} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
