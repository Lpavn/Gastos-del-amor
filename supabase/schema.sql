-- ============================================================
-- Esquema de base de datos para "App Gastos"
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar todo > Run
-- ============================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- Categorías de gasto/ingreso
create table if not exists categories (
  id serial primary key,
  name text not null unique,
  emoji text not null default '💸',
  kind text not null default 'expense' check (kind in ('expense', 'income', 'both'))
);

insert into categories (name, emoji, kind) values
  ('Supermercado', '🛒', 'expense'),
  ('Comida afuera / delivery', '🍔', 'expense'),
  ('Transporte', '🚗', 'expense'),
  ('Servicios (luz, gas, internet)', '💡', 'expense'),
  ('Alquiler / Expensas', '🏠', 'expense'),
  ('Salud', '💊', 'expense'),
  ('Entretenimiento', '🎬', 'expense'),
  ('Ropa', '👕', 'expense'),
  ('Mascotas', '🐾', 'expense'),
  ('Sueldo / Aporte', '💰', 'income'),
  ('Otros ingresos', '➕', 'income'),
  ('Otros', '🔖', 'both')
on conflict (name) do nothing;

-- Movimientos (ingresos y gastos)
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  date date not null default current_date,
  type text not null check (type in ('expense', 'income')),
  amount numeric(12, 2) not null check (amount >= 0),
  description text not null default '',
  category_id integer references categories(id),
  paid_by text not null,              -- nombre de quién pagó / aportó (texto libre, ver env NEXT_PUBLIC_PERSON_1_NAME / 2)
  receipt_url text,                   -- url pública en el bucket "receipts" si vino de una foto
  source text not null default 'manual' check (source in ('manual', 'ai_receipt', 'ai_email'))
);

create index if not exists transactions_date_idx on transactions (date);
create index if not exists transactions_category_idx on transactions (category_id);

-- NOTA DE SEGURIDAD:
-- Esta app está pensada para uso privado entre dos personas y NO usa autenticación
-- de usuarios (Supabase Auth). El acceso se protege con un PIN simple a nivel de
-- aplicación (ver NEXT_PUBLIC_APP_PIN). Row Level Security queda deshabilitado
-- (comportamiento por defecto de una tabla nueva) para simplificar el uso con la
-- clave "anon". No subas tu URL + anon key a un repositorio público, y no
-- compartas el link de la app fuera de la pareja.

-- Habilitar Realtime para que el balance se actualice solo en ambos celulares
alter publication supabase_realtime add table transactions;
