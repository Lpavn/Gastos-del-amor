"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Category, Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import ProductForm from "@/components/ProductForm";

export default function CartaPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  async function load() {
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*").order("sort_order"),
    ]);
    setCategories(cats || []);
    setProducts(prods || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleAvailable(p: Product) {
    setProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, available: !x.available } : x))
    );
    await supabase
      .from("products")
      .update({ available: !p.available })
      .eq("id", p.id);
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`¿Borrar "${p.name}" de la carta?`)) return;
    await supabase.from("products").delete().eq("id", p.id);
    load();
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    await supabase
      .from("categories")
      .insert({ name, sort_order: categories.length + 1 });
    setNewCategoryName("");
    load();
  }

  return (
    <div className="px-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Carta</h1>
        <button
          onClick={() => setEditing("new")}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white active:bg-brand-700"
        >
          + Producto
        </button>
      </div>

      <div className="mb-4 flex gap-2 rounded-2xl bg-white p-3 shadow-sm">
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nueva categoría (ej. Postres)"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <button
          onClick={addCategory}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600"
        >
          Agregar
        </button>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
      ) : (
        <div className="flex flex-col gap-5">
          {categories.map((cat) => {
            const items = products.filter((p) => p.category_id === cat.id);
            if (items.length === 0) return null;
            return (
              <div key={cat.id}>
                <h2 className="mb-2 text-sm font-semibold text-gray-500">
                  {cat.name}
                </h2>
                <ul className="flex flex-col gap-2">
                  {items.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
                    >
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo_url}
                          alt={p.name}
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xl">
                          🍽️
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {p.name}
                        </p>
                        <p className="text-xs text-gray-400">{formatMoney(p.price)}</p>
                      </div>
                      <button
                        onClick={() => toggleAvailable(p)}
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          p.available
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {p.available ? "Disponible" : "Pausado"}
                      </button>
                      <button
                        onClick={() => setEditing(p)}
                        className="text-sm text-gray-400"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteProduct(p)}
                        className="text-sm text-gray-300"
                      >
                        🗑️
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {products.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-400">
              Todavía no cargaste productos.
            </p>
          )}
        </div>
      )}

      {editing && (
        <ProductForm
          categories={categories}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
