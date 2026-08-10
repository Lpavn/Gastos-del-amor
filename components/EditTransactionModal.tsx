"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Category, Transaction } from "@/lib/types";
import { PERSON_1, PERSON_2 } from "@/lib/person";
import { normalizeMerchantKey } from "@/lib/merchantKey";

export default function EditTransactionModal({
  transaction,
  categories,
  onClose,
  onSaved,
}: {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState({
    date: transaction.date,
    type: transaction.type,
    amount: Number(transaction.amount),
    description: transaction.description,
    category_id: transaction.category_id,
    paid_by: transaction.paid_by,
  });
  const [merchantKey, setMerchantKey] = useState(transaction.merchant_key || "");
  const [rememberRule, setRememberRule] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const selectedCategory = categories.find((c) => c.id === form.category_id) || null;
  const [status, setStatus] = useState<"idle" | "saving" | "deleting">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || form.amount <= 0) {
      setErrorMsg("Ingresá un monto válido.");
      return;
    }
    if (rememberRule && !normalizeMerchantKey(merchantKey)) {
      setErrorMsg("Completá el alias/comercio para poder recordar la categoría.");
      return;
    }
    if (rememberRule && !form.category_id) {
      setErrorMsg("Elegí una categoría para poder recordarla.");
      return;
    }

    setStatus("saving");
    setErrorMsg("");

    // Si tildaste "recordar" y pusiste un nombre personalizado, ese nombre
    // pasa a ser la descripción de este movimiento también (no solo de los
    // futuros).
    const finalDescription =
      rememberRule && displayName.trim() ? displayName.trim() : form.description;

    const { error } = await supabase
      .from("transactions")
      .update({
        date: form.date,
        type: form.type,
        amount: form.amount,
        description: finalDescription,
        category_id: form.category_id,
        paid_by: form.paid_by,
        merchant_key: normalizeMerchantKey(merchantKey) || null,
      })
      .eq("id", transaction.id);

    if (error) {
      setStatus("idle");
      setErrorMsg(error.message);
      return;
    }

    if (rememberRule && form.category_id) {
      const { error: ruleError } = await supabase
        .from("category_rules")
        .upsert(
          {
            match_key: normalizeMerchantKey(merchantKey),
            category_id: form.category_id,
            display_name: displayName.trim() || null,
          },
          { onConflict: "match_key" }
        );
      if (ruleError) {
        setStatus("idle");
        setErrorMsg("El movimiento se guardó, pero no se pudo grabar la regla: " + ruleError.message);
        return;
      }
    }

    onSaved?.();
    onClose();
  }

  async function handleDelete() {
    setStatus("deleting");
    setErrorMsg("");
    const { error } = await supabase.from("transactions").delete().eq("id", transaction.id);
    if (error) {
      setStatus("idle");
      setErrorMsg(error.message);
      return;
    }
    onSaved?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Editar movimiento</h2>
          <button type="button" onClick={onClose} className="text-sm text-gray-400">
            Cerrar
          </button>
        </div>

        {errorMsg && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descripción"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="Monto"
              value={form.amount || ""}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "expense" | "income" })}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
            <select
              value={form.paid_by}
              onChange={(e) => setForm({ ...form, paid_by: e.target.value })}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value={PERSON_1}>{PERSON_1}</option>
              <option value={PERSON_2}>{PERSON_2}</option>
            </select>
            <select
              value={form.category_id ?? ""}
              onChange={(e) =>
                setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })
              }
              className="col-span-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Alias / comercio (tal cual llega del mail, para reconocerlo la próxima vez)
            </label>
            <input
              value={merchantKey}
              onChange={(e) => setMerchantKey(e.target.value)}
              placeholder="ej. ALQUILER.CASA o MERPAGO*CENTRAL"
              className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />

            <label className="mt-1 flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={rememberRule}
                onChange={(e) => setRememberRule(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Recordar que este alias/comercio es siempre{" "}
                <strong>
                  {selectedCategory
                    ? `${selectedCategory.emoji} ${selectedCategory.name}`
                    : "(elegí una categoría arriba)"}
                </strong>
              </span>
            </label>

            {rememberRule && (
              <div className="mt-2 pl-6">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Nombre para mostrar (opcional, ej. "Empanadas")
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={form.description || "Nombre del movimiento"}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Si lo completás, se usa como descripción de este movimiento y de los
                  próximos con el mismo alias (la categoría sigue siendo la de arriba).
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={status === "saving" || status === "deleting"}
            className="mt-1 w-full rounded-xl bg-brand-600 py-3 font-medium text-white active:bg-brand-700 disabled:opacity-50"
          >
            {status === "saving" ? "Guardando…" : "Guardar cambios"}
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={status === "saving" || status === "deleting"}
              className="w-full rounded-xl border border-red-200 py-3 font-medium text-red-600 disabled:opacity-50"
            >
              Eliminar movimiento
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border border-gray-200 py-3 font-medium text-gray-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={status === "deleting"}
                className="flex-1 rounded-xl bg-red-600 py-3 font-medium text-white active:bg-red-700 disabled:opacity-50"
              >
                {status === "deleting" ? "Eliminando…" : "Confirmar"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
