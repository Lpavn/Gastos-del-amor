"use client";

import { Category, DraftTransaction } from "@/lib/types";
import { PERSON_1, PERSON_2 } from "@/lib/person";

const CONFIDENCE_COLOR: Record<string, string> = {
  alta: "bg-brand-100 text-brand-700",
  media: "bg-amber-100 text-amber-700",
  baja: "bg-red-100 text-red-700",
};

export default function ReviewTable({
  drafts,
  categories,
  onChange,
  onRemove,
}: {
  drafts: DraftTransaction[];
  categories: Category[];
  onChange: (index: number, patch: Partial<DraftTransaction>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {drafts.map((d, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLOR[d.confidence] || ""}`}
            >
              Confianza {d.confidence}
            </span>
            <button
              onClick={() => onRemove(i)}
              className="text-xs text-gray-400 underline"
              type="button"
            >
              Quitar
            </button>
          </div>

          <input
            value={d.description}
            onChange={(e) => onChange(i, { description: e.target.value })}
            placeholder="Descripción"
            className="mb-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={d.date}
              onChange={(e) => onChange(i, { date: e.target.value })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              inputMode="decimal"
              value={d.amount}
              onChange={(e) => onChange(i, { amount: Number(e.target.value) })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />

            <select
              value={d.type}
              onChange={(e) => onChange(i, { type: e.target.value as "expense" | "income" })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>

            <select
              value={d.paid_by}
              onChange={(e) => onChange(i, { paid_by: e.target.value })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            >
              <option value={PERSON_1}>{PERSON_1}</option>
              <option value={PERSON_2}>{PERSON_2}</option>
            </select>

            <select
              value={d.category_name}
              onChange={(e) => onChange(i, { category_name: e.target.value })}
              className="col-span-2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
