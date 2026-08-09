"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Category, Product, CartLine } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import ProductCard from "@/components/ProductCard";
import CartDrawer from "@/components/CartDrawer";

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase
          .from("products")
          .select("*")
          .eq("available", true)
          .order("sort_order"),
      ]);
      if (!active) return;
      setCategories(cats || []);
      setProducts(prods || []);
      setActiveCategory((cats && cats[0]?.id) || null);
      setLoading(false);
    }
    load();

    // Tiempo real: si el dueño cambia la carta desde el panel, se ve al
    // instante acá sin recargar (igual patrón que el balance de Gastos del Amor).
    const channel = supabase
      .channel("menu-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const productsByCategory = useMemo(() => {
    if (!activeCategory) return [];
    return products.filter((p) => p.category_id === activeCategory);
  }, [products, activeCategory]);

  const cartLines: CartLine[] = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({
        product: products.find((p) => p.id === productId)!,
        quantity: qty,
      }))
      .filter((l) => l.product);
  }, [cart, products]);

  const cartCount = cartLines.reduce((s, l) => s + l.quantity, 0);
  const cartTotal = cartLines.reduce(
    (s, l) => s + l.product.price * l.quantity,
    0
  );

  function increment(productId: string) {
    setCart((c) => ({ ...c, [productId]: (c[productId] || 0) + 1 }));
  }
  function decrement(productId: string) {
    setCart((c) => {
      const next = { ...c, [productId]: Math.max(0, (c[productId] || 0) - 1) };
      return next;
    });
  }

  async function handleSubmit(data: {
    customerName: string;
    tableNumber: string;
    notes: string;
  }) {
    setSubmitting(true);
    setError(null);
    try {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          customer_name: data.customerName,
          table_number: data.tableNumber || null,
          notes: data.notes || null,
          total: cartTotal,
          status: "nuevo",
        })
        .select()
        .single();

      if (orderErr || !order) throw orderErr || new Error("No se pudo crear el pedido.");

      const items = cartLines.map((l) => ({
        order_id: order.id,
        product_id: l.product.id,
        product_name: l.product.name,
        quantity: l.quantity,
        unit_price: l.product.price,
        subtotal: l.product.price * l.quantity,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      setConfirmedOrder(order.id.slice(0, 8).toUpperCase());
      setCart({});
      setCartOpen(false);
    } catch (err: any) {
      setError(err?.message || "No se pudo enviar el pedido. Probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedOrder) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          ¡Pedido enviado!
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          N° de pedido <span className="font-mono font-semibold">{confirmedOrder}</span>.
          Ya aparece en el panel del local.
        </p>
        <button
          onClick={() => setConfirmedOrder(null)}
          className="mt-6 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white active:bg-brand-700"
        >
          Hacer otro pedido
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <header className="sticky top-0 z-30 bg-brand-600 px-5 pb-4 pt-6 text-white">
        <h1 className="text-xl font-bold">Sabor Casero</h1>
        <p className="text-sm text-brand-100">Menú digital · Mesa libre</p>
      </header>

      <nav className="no-scrollbar sticky top-[76px] z-20 flex gap-2 overflow-x-auto bg-[#f7f8fa] px-5 py-3">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
              activeCategory === c.id
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-500 shadow-sm"
            }`}
          >
            {c.name}
          </button>
        ))}
      </nav>

      <main className="flex flex-col gap-3 px-5 py-3">
        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
        ) : productsByCategory.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            No hay productos en esta categoría.
          </p>
        ) : (
          productsByCategory.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              quantity={cart[p.id] || 0}
              onAdd={() => increment(p.id)}
              onRemove={() => decrement(p.id)}
            />
          ))
        )}
      </main>

      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-5 left-1/2 z-40 flex w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-2xl bg-brand-600 px-5 py-4 text-white shadow-lg"
        >
          <span className="font-semibold">Ver pedido ({cartCount})</span>
          <span className="font-bold">{formatMoney(cartTotal)}</span>
        </button>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cartLines}
        onIncrement={increment}
        onDecrement={decrement}
        onSubmit={handleSubmit}
        submitting={submitting}
        error={error}
      />
    </div>
  );
}
