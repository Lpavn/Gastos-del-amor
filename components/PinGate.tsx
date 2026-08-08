"use client";

import { useEffect, useState } from "react";

const UNLOCK_KEY = "app-gastos:unlocked";

export default function PinGate({ children }: { children: React.ReactNode }) {
  const requiredPin = process.env.NEXT_PUBLIC_APP_PIN || "";
  const [unlocked, setUnlocked] = useState(requiredPin === "");
  const [checked, setChecked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (requiredPin === "") {
      setUnlocked(true);
      setChecked(true);
      return;
    }
    const saved = window.localStorage.getItem(UNLOCK_KEY);
    if (saved === requiredPin) setUnlocked(true);
    setChecked(true);
  }, [requiredPin]);

  function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (input === requiredPin) {
      window.localStorage.setItem(UNLOCK_KEY, input);
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  if (!checked) return null;

  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50 px-6">
        <form
          onSubmit={tryUnlock}
          className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-sm"
        >
          <h1 className="mb-1 text-lg font-semibold text-gray-900">
            App de Gastos 🏡
          </h1>
          <p className="mb-4 text-sm text-gray-500">Ingresá el PIN para entrar.</p>
          <input
            autoFocus
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="PIN"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-brand-500"
          />
          {error && (
            <p className="mt-2 text-sm text-red-500">PIN incorrecto, probá de nuevo.</p>
          )}
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-brand-600 py-2 font-medium text-white active:bg-brand-700"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
