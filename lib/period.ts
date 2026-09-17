// Helpers para navegar movimientos por semana/mes/año, compartidos entre
// /movimientos (historial) y /stats (drill-down por categoría).

export type PeriodMode = "week" | "month" | "year";

function atMidnight(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// Semana de lunes a domingo (convención AR).
function startOfWeek(d: Date): Date {
  const date = atMidnight(d);
  const day = date.getDay(); // 0 = domingo ... 6 = sábado
  const diff = day === 0 ? -6 : 1 - day; // corrimiento hasta el lunes
  date.setDate(date.getDate() + diff);
  return date;
}

export function getPeriodRange(mode: PeriodMode, anchor: Date): { start: Date; end: Date } {
  if (mode === "week") {
    const start = startOfWeek(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  }
  if (mode === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { start, end };
  }
  const start = new Date(anchor.getFullYear(), 0, 1);
  const end = new Date(anchor.getFullYear(), 11, 31);
  return { start, end };
}

// Construye un anchor nuevo en vez de mutar el día del actual, para no
// pisarse con meses de distinta duración (ej. 31 de enero + 1 mes no debe
// "saltearse" febrero).
export function shiftPeriod(mode: PeriodMode, anchor: Date, dir: 1 | -1): Date {
  if (mode === "week") {
    const d = new Date(anchor);
    d.setDate(d.getDate() + 7 * dir);
    return d;
  }
  if (mode === "month") {
    return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  }
  return new Date(anchor.getFullYear() + dir, 0, 1);
}

export function formatPeriodLabel(mode: PeriodMode, anchor: Date): string {
  if (mode === "week") {
    const { start, end } = getPeriodRange(mode, anchor);
    const fmt = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
    return `${fmt(start)} – ${fmt(end)}`;
  }
  if (mode === "month") {
    return anchor.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }
  return String(anchor.getFullYear());
}

export function isInRange(dateStr: string, start: Date, end: Date): boolean {
  const d = new Date(dateStr + "T00:00:00");
  return d >= start && d <= end;
}
