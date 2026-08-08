// Debe reflejar los mismos nombres insertados en supabase/schema.sql.
// Se usa para: (1) poblar los <select> del formulario manual y
// (2) decirle a la IA entre qué categorías tiene que elegir al leer un ticket.
export const DEFAULT_CATEGORIES: { name: string; emoji: string; kind: "expense" | "income" | "both" }[] = [
  { name: "Supermercado", emoji: "🛒", kind: "expense" },
  { name: "Comida afuera / delivery", emoji: "🍔", kind: "expense" },
  { name: "Transporte", emoji: "🚗", kind: "expense" },
  { name: "Servicios (luz, gas, internet)", emoji: "💡", kind: "expense" },
  { name: "Alquiler / Expensas", emoji: "🏠", kind: "expense" },
  { name: "Salud", emoji: "💊", kind: "expense" },
  { name: "Entretenimiento", emoji: "🎬", kind: "expense" },
  { name: "Ropa", emoji: "👕", kind: "expense" },
  { name: "Mascotas", emoji: "🐾", kind: "expense" },
  { name: "Sueldo / Aporte", emoji: "💰", kind: "income" },
  { name: "Otros ingresos", emoji: "➕", kind: "income" },
  { name: "Otros", emoji: "🔖", kind: "both" },
];
