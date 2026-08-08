-- ============================================================
-- Migración: soporte para movimientos importados por mail (Google Apps Script)
-- Ejecutar SOLO si ya habías corrido supabase/schema.sql ANTES de sumar esta
-- funcionalidad (si es una base nueva, schema.sql ya incluye este cambio).
-- Dashboard > SQL Editor > New query > pegar todo > Run.
-- ============================================================

alter table transactions drop constraint if exists transactions_source_check;
alter table transactions add constraint transactions_source_check
  check (source in ('manual', 'ai_receipt', 'ai_email'));
