"use client";

import { Transaction } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { PERSON_1, PERSON_2 } from "@/lib/person";

export default function BalanceCard({ transactions }: { transactions: Transaction[] }) {
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const contributionsFor = (person: string) =>
    transactions
      .filter((t) => t.type === "income" && t.paid_by === person)
      .reduce((s, t) => s + Number(t.amount), 0);

  const spentBy = (person: string) =>
    transactions
      .filter((t) => t.type === "expense" && t.paid_by === person)
      .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white shadow-sm">
      <p className="text-sm text-brand-50/80">Balance en conjunto</p>
      <p className="mt-1 text-3xl font-bold">{formatMoney(balance)}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {[PERSON_1, PERSON_2].map((person) => (
          <div key={person} className="rounded-xl bg-white/10 p-3">
            <p className="font-medium">{person}</p>
            <p className="text-brand-50/80">Aportó {formatMoney(contributionsFor(person))}</p>
            <p className="text-brand-50/80">Gastó {formatMoney(spentBy(person))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
