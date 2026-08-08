"use client";

export const PERSON_1 = process.env.NEXT_PUBLIC_PERSON_1_NAME || "Persona 1";
export const PERSON_2 = process.env.NEXT_PUBLIC_PERSON_2_NAME || "Persona 2";

const STORAGE_KEY = "app-gastos:current-person";

export function getCurrentPerson(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setCurrentPerson(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, name);
}
