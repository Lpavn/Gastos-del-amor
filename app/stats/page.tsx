"use client";

import { useMemo, useState } from "react";
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

const COLORS = [
  "#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4338ca",
];

type RangeMode = "month" | "year";

export default function StatsPage() {
  const { transactions, categoryById, loading } = useTransactions();
  const [rangeMode, setRangeMode] = useState<RangeMode>("month");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.date + "T00:00:00");
      if (d.getFullYear() !== year) return false;
      if (rangeMode === "month" && d.getMonth() !== month) return false;
      return true;
    });
  }, [transactions, year, month, rangeMode]);

  const expenses = filtered.filter((t) => t.type === "expense");
  const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = filtered
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of expenses) {
      const name = t.category_id ? categoryById[t.category_id]?.name : "Sin categoría";
      map.set(name || "Sin categoría", (map.get(name || "Sin categoría") || 0) + Number(t.amount));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, categoryById]);

  const byMonth = useMemo(() => {
    if (rangeMode !== "year") return [];
    const map = new Map<number, number>();
    for (const t of transactions.filter((t) => t.type === "expense")) {
      const d = new Date(t.date + "T00:00:00");
      if (d.getFullYear() !== year) continue;
      map.set(d.getMonth(), (map.get(d.getMonth()) || 0) + Number(t.amount));
    }
    const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return labels.map((label, i) => ({ label, total: map.get(i) || 0 }));
  }, [transactions, year, rangeMode]);

  const monthLabels = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  if (loading) {
    return <div className="px-4 pt-6"><div className="h-40 animate-pulse rounded-2xl bg-gray-200" /></div>;
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Estadísticas</h1>

      <div className="mb-4 flex gap-2">
        <div className="flex rounded-full bg-gray-100 p-1 text-sm font-medium">
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

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm"
        >
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
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
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Gastos por categoría</h2>
        {byCategory.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Sin gastos en este período.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 flex flex-col gap-1">
              {byCategory.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {c.name}
                  </span>
                  <span className="font-medium text-gray-700">
                    {formatMoney(c.value)} · {((c.value / totalExpense) * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {rangeMode === "year" && (
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Gastos por mes ({year})</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} width={40} />
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Bar dataKey="total" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
