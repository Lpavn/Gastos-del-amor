"use client";

import { useState } from "react";
import { CartLine } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export default function CartDrawer({
  open,
  onClose,
  lines,
  onIncrement,
  onDecrement,
  onSubmit,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onSubmit: (data: {
    customerName: string;
    tableNumber: string;
    notes: string;
  }) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");

  const total = lines.reduce(
    (sum, l) => sum + l.product.price * l.quantity,
    0
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">Tu pedido</h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-gray-400"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              Todavía no agregaste nada.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((l) => (
                <li
                  key={l.product.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {l.product.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatMoney(l.product.price)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full bg-gray-100 px-2 py-1">
                      <button
                        onClick={() => onDecrement(l.product.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm"
                      >
                        −
                      </button>
                      <span className="w-4 text-center font-semibold">
                        {l.quantity}
                      </span>
                      <button
                        onClick={() => onIncrement(l.product.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-16 text-right font-semibold text-gray-800">
                      {formatMoney(l.product.price * l.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {lines.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tu nombre"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="N° de mesa (opcional)"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas (ej. sin cebolla, para llevar...)"
                rows={2}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
          )}

          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="text-lg font-bold text-gray-900">
                {formatMoney(total)}
              </span>
            </div>
            <button
              disabled={submitting || !customerName.trim()}
              onClick={() => onSubmit({ customerName, tableNumber, notes })}
              className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50 active:bg-brand-700"
            >
              {submitting ? "Enviando..." : "Confirmar pedido"}
            </button>
            {!customerName.trim() && (
              <p className="mt-1 text-center text-xs text-gray-400">
                Ingresá tu nombre para confirmar
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
