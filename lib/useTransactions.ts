"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Category, Transaction } from "@/lib/types";

// Hook compartido: trae categorías + movimientos y se suscribe a Realtime
// para que el balance se actualice solo en los dos celulares apenas alguien
// carga un gasto nuevo.
export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: tx }, { data: cats }] = await Promise.all([
      supabase.from("transactions").select("*").order("date", { ascending: false }),
      supabase.from("categories").select("*"),
    ]);
    if (tx) setTransactions(tx as Transaction[]);
    if (cats) setCategories(cats as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("transactions-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

  return { transactions, categories, categoryById, loading, refresh: load };
}
