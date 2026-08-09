"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Category, Product } from "@/lib/types";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result viene como "data:image/jpeg;base64,AAAA..." — solo mandamos la parte de datos
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProductForm({
  categories,
  product,
  onClose,
  onSaved,
}: {
  categories: Category[];
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [categoryId, setCategoryId] = useState(
    product?.category_id || categories[0]?.id || ""
  );
  const [available, setAvailable] = useState(product?.available ?? true);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    product?.photo_url || null
  );

  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiHint, setAiHint] = useState<string | null>(null);

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setAiHint(null);
  }

  async function handleAiFill() {
    if (!imageFile) return;
    setAiLoading(true);
    setError(null);
    setAiHint(null);
    try {
      const base64 = await fileToBase64(imageFile);
      const res = await fetch("/api/parse-menu-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mimeType: imageFile.type,
          categoryNames: categories.map((c) => c.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo leer la foto.");

      if (data.name) setName(data.name);
      if (data.description) setDescription(data.description);
      if (typeof data.price === "number") setPrice(String(data.price));

      const match = categories.find(
        (c) => c.name.toLowerCase() === (data.category_name || "").toLowerCase()
      );
      if (match) {
        setCategoryId(match.id);
      } else {
        setAiHint("La IA no reconoció la categoría — revisala a mano.");
      }
    } catch (err: any) {
      setError(err?.message || "Error al leer la foto con IA.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || !price) {
      setError("Completá al menos el nombre y el precio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let photoUrl = product?.photo_url || null;

      if (imageFile) {
        const path = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;
        const { error: uploadErr } = await supabase.storage
          .from("menu-photos")
          .upload(path, imageFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data } = supabase.storage.from("menu-photos").getPublicUrl(path);
        photoUrl = data.publicUrl;
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        category_id: categoryId || null,
        available,
        photo_url: photoUrl,
      };

      if (product) {
        const { error: updErr } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from("products").insert(payload);
        if (insErr) throw insErr;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          "No se pudo guardar. Si es un error de Storage, revisá que exista el bucket 'menu-photos' en Supabase."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {product ? "Editar producto" : "Nuevo producto"}
          </h2>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400">
            ×
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="" className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-50 text-2xl">
              🍽️
            </div>
          )}
          <div className="flex flex-1 flex-col gap-1">
            <label className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-center text-xs font-medium text-gray-600">
              📷 Elegir foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePickImage}
              />
            </label>
            <button
              disabled={!imageFile || aiLoading}
              onClick={handleAiFill}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {aiLoading ? "Leyendo con IA..." : "✨ Completar con IA"}
            </button>
          </div>
        </div>

        {aiHint && <p className="mb-2 text-xs text-amber-600">{aiHint}</p>}

        <div className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del producto"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            rows={2}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="Precio"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
            Disponible en el menú
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <button
          disabled={saving}
          onClick={handleSave}
          className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50 active:bg-brand-700"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
