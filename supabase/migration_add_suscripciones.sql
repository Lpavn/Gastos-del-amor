-- ============================================================
-- Migración: agrega la categoría "Suscripciones" (Spotify, Netflix, etc.)
-- Ejecutar SOLO si ya habías corrido supabase/schema.sql ANTES de sumar esta
-- categoría (si es una base nueva, schema.sql ya la incluye).
-- Dashboard > SQL Editor > New query > pegar todo > Run.
-- ============================================================

insert into categories (name, emoji, kind) values
  ('Suscripciones', '📺', 'expense')
on conflict (name) do nothing;
