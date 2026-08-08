"use client";

import { useTransactions } from "@/lib/useTransactions";
import BalanceCard from "@/components/BalanceCard";
import TransactionList from "@/components/TransactionList";
import Link from "next/link";

export default function DashboardPage() {
  const { transactions, categoryById, loading } = useTransactions();

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Nuestros gastos</h1>

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-gray-200" />
      ) : (
        <BalanceCard transactions={transactions} />
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Últimos movimientos</h2>
        <Link href="/add" className="text-sm font-medium text-brand-600">
          + Agregar
        </Link>
      </div>

      <div className="mt-2 rounded-2xl bg-white px-4 shadow-sm">
        <TransactionList transactions={transactions.slice(0, 15)} categoryById={categoryById} />
      </div>
    </div>
  );
}
