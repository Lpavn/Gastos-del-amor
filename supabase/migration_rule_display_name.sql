-- ============================================================
-- Migración: nombre personalizado en las reglas de autocategorización.
-- Ejecutar SOLO si ya habías corrido migration_category_rules.sql antes de
-- sumar esta funcionalidad (si es una base nueva, schema.sql ya incluye
-- este cambio).
-- Dashboard > SQL Editor > New query > pegar todo > Run.
-- ============================================================

alter table category_rules add column if not exists display_name text;
