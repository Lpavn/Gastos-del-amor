"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Order, OrderItem, OrderStatus } from "@/lib/types";
import { formatMoney, formatTime, STATUS_LABEL, STATUS_ORDER } from "@/lib/format";

type OrderWithItems = Order & { order_items: OrderItem[] };

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  nuevo: "en_preparacion",
  en_preparacion: "listo",
  listo: "entregado",
  entregado: null,
  cancelado: null,
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  nuevo: "bg-amber-100 text-amber-700",
  en_preparacion: "bg-blue-100 text-blue-700",
  listo: "bg-emerald-100 text-emerald-700",
  entregado: "bg-gray-100 text-gray-500",
  cancelado: "bg-red-100 text-red-600",
};

const FILTERS: { key: string; label: string }[] = [
  { key: "activos", label: "Activos" },
  { key: "todos", label: "Todos" },
  { key: "entregado", label: "Entregados" },
  { key: "cancelado", label: "Cancelados" },
];

export default function PedidosPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("activos");

  async function load() {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders((data as OrderWithItems[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();

    // Tiempo real: los pedidos nuevos del cliente aparecen solos, sin recargar.
    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "todos") return orders;
    if (filter === "activos")
      return orders.filter((o) =>
        ["nuevo", "en_preparacion", "listo"].includes(o.status)
      );
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  async function advance(order: OrderWithItems) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    await supabase.from("orders").update({ status: next }).eq("id", order.id);
    load();
  }

  async function cancel(order: OrderWithItems) {
    await supabase
      .from("orders")
      .update({ status: "cancelado" })
      .eq("id", order.id);
    load();
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Pedidos</h1>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f.key
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-500 shadow-sm"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">
          No hay pedidos acá todavía.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((order) => (
            <li key={order.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    {order.customer_name || "Sin nombre"}
                    {order.table_number ? ` · Mesa ${order.table_number}` : ""}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatTime(order.created_at)} · #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[order.status]}`}
                >
                  {STATUS_LABEL[order.status]}
                </span>
              </div>

              <ul className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-3 text-sm">
                {order.order_items.map((item) => (
                  <li key={item.id} className="flex justify-between text-gray-600">
                    <span>
                      {item.quantity}× {item.product_name}
                    </span>
                    <span>{formatMoney(item.subtotal)}</span>
                  </li>
                ))}
              </ul>

              {order.notes && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  📝 {order.notes}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="font-bold text-gray-900">
                  {formatMoney(order.total)}
                </span>
                <div className="flex gap-2">
                  {NEXT_STATUS[order.status] && (
                    <button
                      onClick={() => advance(order)}
                      className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-brand-700"
                    >
                      Marcar {STATUS_LABEL[NEXT_STATUS[order.status]!]}
                    </button>
                  )}
                  {["nuevo", "en_preparacion", "listo"].includes(order.status) && (
                    <button
                      onClick={() => cancel(order)}
                      className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
