-- ============================================================
-- Migración: reglas de autocategorización por alias/comercio.
-- Ejecutar SOLO si ya habías corrido supabase/schema.sql ANTES de sumar esta
-- funcionalidad (si es una base nueva, schema.sql ya incluye este cambio).
-- Dashboard > SQL Editor > New query > pegar todo > Run.
-- ============================================================

alter table transactions add column if not exists merchant_key text;

create table if not exists category_rules (
  id serial primary key,
  match_key text not null unique,
  category_id integer not null references categories(id),
  created_at timestamptz not null default now()
);
