"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { Order, OrderItem } from "@/lib/types";
import { formatMoney } from "@/lib/format";

type OrderWithItems = Order & { order_items: OrderItem[] };

const COLORS = [
  "#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa",
  "#c2410c", "#9a3412",
];

type RangeMode = "hoy" | "semana";

export default function EstadisticasPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeMode, setRangeMode] = useState<RangeMode>("semana");

  useEffect(() => {
    async function load() {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      setOrders((data as OrderWithItems[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const valid = useMemo(
    () => orders.filter((o) => o.status !== "cancelado"),
    [orders]
  );

  const filtered = useMemo(() => {
    const now = new Date();
    return valid.filter((o) => {
      const d = new Date(o.created_at);
      if (rangeMode === "hoy") {
        return d.toDateString() === now.toDateString();
      }
      const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    });
  }, [valid, rangeMode]);

  const totalVentas = filtered.reduce((s, o) => s + Number(o.total), 0);
  const cantidadPedidos = filtered.length;
  const ticketPromedio = cantidadPedidos > 0 ? totalVentas / cantidadPedidos : 0;

  const ventasPorDia = useMemo(() => {
    const map = new Map<string, number>();
    const labels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("es-AR", { weekday: "short" });
      labels.push(key);
      map.set(d.toDateString(), 0);
    }
    for (const o of valid) {
      const d = new Date(o.created_at);
      const key = d.toDateString();
      if (map.has(key)) map.set(key, (map.get(key) || 0) + Number(o.total));
    }
    let i = 0;
    const result: { label: string; total: number }[] = [];
    for (const [, total] of map) {
      result.push({ label: labels[i], total });
      i++;
    }
    return result;
  }, [valid]);

  const topProductos = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const o of filtered) {
      for (const item of o.order_items) {
        const curr = map.get(item.product_name) || { qty: 0, revenue: 0 };
        curr.qty += item.quantity;
        curr.revenue += Number(item.subtotal);
        map.set(item.product_name, curr);
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [filtered]);

  if (loading) {
    return (
      <div className="px-4 pt-6">
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Estadísticas</h1>

      <div className="mb-4 flex rounded-full bg-gray-100 p-1 text-sm font-medium">
        <button
          onClick={() => setRangeMode("hoy")}
          className={`flex-1 rounded-full px-3 py-1.5 ${
            rangeMode === "hoy" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
          }`}
        >
          Hoy
        </button>
        <button
          onClick={() => setRangeMode("semana")}
          className={`flex-1 rounded-full px-3 py-1.5 ${
            rangeMode === "semana" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
          }`}
        >
          Últimos 7 días
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-xs text-gray-400">Ventas</p>
          <p className="text-base font-bold text-gray-900">{formatMoney(totalVentas)}</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-xs text-gray-400">Pedidos</p>
          <p className="text-base font-bold text-gray-900">{cantidadPedidos}</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-xs text-gray-400">Ticket prom.</p>
          <p className="text-base font-bold text-gray-900">{formatMoney(ticketPromedio)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          Ventas de los últimos 7 días
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={ventasPorDia}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} width={40} />
            <Tooltip formatter={(v: number) => formatMoney(v)} />
            <Bar dataKey="total" fill="#ea580c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Productos más vendidos</h2>
        {topProductos.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            Sin ventas en este período.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={topProductos}
                  dataKey="revenue"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                >
                  {topProductos.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 flex flex-col gap-1">
              {topProductos.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="shrink-0 font-medium text-gray-700">
                    {p.qty}u · {formatMoney(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
