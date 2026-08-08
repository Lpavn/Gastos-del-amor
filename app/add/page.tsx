"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Category, DraftTransaction } from "@/lib/types";
import { PERSON_1, PERSON_2, getCurrentPerson } from "@/lib/person";
import ReviewTable from "@/components/ReviewTable";

// Las fotos que salen de la cámara del celular suelen pesar varios MB, y
// Vercel rechaza (413 "Request Entity Too Large") cualquier request de más
// de ~4.5MB. Achicamos la imagen en el propio celular antes de mandarla:
// igual se lee perfecto el texto de un ticket con 1600px de lado más largo.
function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.75
): Promise<{ file: File; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("No se pudo procesar la imagen."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("No se pudo comprimir la imagen."));
            return;
          }
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.\w+$/, "") + ".jpg",
            { type: "image/jpeg" }
          );
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string; // data:<mime>;base64,<data>
            const [, base64] = result.split(",");
            resolve({ file: compressedFile, base64, mimeType: "image/jpeg" });
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo abrir la imagen."));
    };
    img.src = objectUrl;
  });
}

export default function AddPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"foto" | "manual">("foto");
  const [categories, setCategories] = useState<Category[]>([]);
  const [drafts, setDrafts] = useState<DraftTransaction[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [manual, setManual] = useState<DraftTransaction>({
    date: new Date().toISOString().slice(0, 10),
    type: "expense",
    amount: 0,
    description: "",
    category_name: "Otros",
    paid_by: PERSON_1,
    confidence: "alta",
  });

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .then(({ data }) => {
        if (data) setCategories(data as Category[]);
      });
    const current = getCurrentPerson();
    if (current) setManual((m) => ({ ...m, paid_by: current }));
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;
    setStatus("parsing");
    setErrorMsg("");
    setDrafts([]);
    setPhotoFile(null);
    setPhotoPreview(null);

    try {
      const { file, base64, mimeType } = await compressImage(original);
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));

      const res = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.status === 413
            ? "La foto sigue siendo muy pesada. Probá sacarla de nuevo o con menos zoom."
            : "Hubo un problema de conexión al procesar la foto. Probá de nuevo."
        );
      }
      if (!res.ok) throw new Error(data.error || "No se pudo leer la imagen.");

      const current = getCurrentPerson() || PERSON_1;
      const withPerson = (data.transactions || []).map((t: DraftTransaction) => ({
        ...t,
        paid_by: current,
      }));
      setDrafts(withPerson);
      setStatus("idle");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Error al procesar la imagen.");
    }
  }

  function updateDraft(index: number, patch: Partial<DraftTransaction>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }
  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadReceiptIfNeeded(): Promise<string | null> {
    if (!photoFile) return null;
    const path = `${Date.now()}-${photoFile.name}`;
    const { error } = await supabase.storage.from("receipts").upload(path, photoFile);
    if (error) {
      console.error("No se pudo subir la foto al storage:", error.message);
      return null;
    }
    const { data } = supabase.storage.from("receipts").getPublicUrl(path);
    return data.publicUrl;
  }

  function categoryIdFor(name: string) {
    return categories.find((c) => c.name === name)?.id ?? null;
  }

  async function saveDrafts() {
    if (drafts.length === 0) return;
    setStatus("saving");
    const receiptUrl = await uploadReceiptIfNeeded();

    const rows = drafts.map((d) => ({
      date: d.date,
      type: d.type,
      amount: d.amount,
      description: d.description,
      category_id: categoryIdFor(d.category_name),
      paid_by: d.paid_by,
      receipt_url: receiptUrl,
      source: "ai_receipt" as const,
    }));

    const { error } = await supabase.from("transactions").insert(rows);
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    router.push("/");
  }

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manual.amount || manual.amount <= 0) {
      setErrorMsg("Ingresá un monto válido.");
      return;
    }
    setStatus("saving");
    const { error } = await supabase.from("transactions").insert([
      {
        date: manual.date,
        type: manual.type,
        amount: manual.amount,
        description: manual.description,
        category_id: categoryIdFor(manual.category_name),
        paid_by: manual.paid_by,
        source: "manual",
      },
    ]);
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    router.push("/");
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Agregar movimiento</h1>

      <div className="mb-4 flex rounded-full bg-gray-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("foto")}
          className={`flex-1 rounded-full py-1.5 ${mode === "foto" ? "bg-white shadow-sm text-brand-700" : "text-gray-500"}`}
        >
          📷 Foto con IA
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 rounded-full py-1.5 ${mode === "manual" ? "bg-white shadow-sm text-brand-700" : "text-gray-500"}`}
        >
          ✍️ Manual
        </button>
      </div>

      {errorMsg && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>
      )}

      {mode === "foto" && (
        <div>
          {!photoPreview && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-white py-10 text-gray-500"
            >
              <span className="text-3xl">📸</span>
              <span className="text-sm">Sacar foto o subir ticket / comprobante</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />

          {photoPreview && (
            <div className="mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Foto cargada" className="max-h-48 w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  setDrafts([]);
                }}
                className="mt-2 text-xs text-gray-400 underline"
              >
                Sacar otra foto
              </button>
            </div>
          )}

          {status === "parsing" && (
            <p className="py-4 text-center text-sm text-gray-500">
              Leyendo la imagen con IA…
            </p>
          )}

          {drafts.length > 0 && (
            <>
              <ReviewTable
                drafts={drafts}
                categories={categories}
                onChange={updateDraft}
                onRemove={removeDraft}
              />
              <button
                type="button"
                onClick={saveDrafts}
                disabled={status === "saving"}
                className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-medium text-white active:bg-brand-700 disabled:opacity-50"
              >
                {status === "saving" ? "Guardando…" : `Guardar ${drafts.length} movimiento(s)`}
              </button>
            </>
          )}
        </div>
      )}

      {mode === "manual" && (
        <form onSubmit={saveManual} className="flex flex-col gap-3">
          <input
            value={manual.description}
            onChange={(e) => setManual({ ...manual, description: e.target.value })}
            placeholder="Descripción"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={manual.date}
              onChange={(e) => setManual({ ...manual, date: e.target.value })}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="Monto"
              value={manual.amount || ""}
              onChange={(e) => setManual({ ...manual, amount: Number(e.target.value) })}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <select
              value={manual.type}
              onChange={(e) => setManual({ ...manual, type: e.target.value as "expense" | "income" })}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
            <select
              value={manual.paid_by}
              onChange={(e) => setManual({ ...manual, paid_by: e.target.value })}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value={PERSON_1}>{PERSON_1}</option>
              <option value={PERSON_2}>{PERSON_2}</option>
            </select>
            <select
              value={manual.category_name}
              onChange={(e) => setManual({ ...manual, category_name: e.target.value })}
              className="col-span-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={status === "saving"}
            className="mt-2 w-full rounded-xl bg-brand-600 py-3 font-medium text-white active:bg-brand-700 disabled:opacity-50"
          >
            {status === "saving" ? "Guardando…" : "Guardar movimiento"}
          </button>
        </form>
      )}
    </div>
  );
}
