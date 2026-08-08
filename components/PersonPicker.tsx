"use client";

import { useEffect, useState } from "react";
import { PERSON_1, PERSON_2, getCurrentPerson, setCurrentPerson } from "@/lib/person";

// Modal simple que aparece la primera vez que se abre la app en un celular
// para saber "quién sos" (se guarda en ese dispositivo, no hay login real).
export default function PersonPicker() {
  const [person, setPerson] = useState<string | null>("loading");

  useEffect(() => {
    setPerson(getCurrentPerson());
  }, []);

  if (person === "loading" || person) return null;

  function choose(name: string) {
    setCurrentPerson(name);
    setPerson(name);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-lg">
        <p className="mb-4 text-base font-medium text-gray-900">
          ¿Quién sos vos en este celular?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => choose(PERSON_1)}
            className="rounded-lg bg-brand-600 py-2 font-medium text-white active:bg-brand-700"
          >
            {PERSON_1}
          </button>
          <button
            onClick={() => choose(PERSON_2)}
            className="rounded-lg bg-gray-100 py-2 font-medium text-gray-800 active:bg-gray-200"
          >
            {PERSON_2}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Se guarda solo en este dispositivo, lo podés cambiar en cualquier momento.
        </p>
      </div>
    </div>
  );
}
