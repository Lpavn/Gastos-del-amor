-- Suma 'ai_chat' como source válido, para los movimientos cargados por el
-- bot de Telegram (ver README > "Bot de Telegram"). Correr en el SQL Editor
-- de Supabase si el proyecto ya existía antes de agregar esta función.
alter table transactions drop constraint if exists transactions_source_check;
alter table transactions add constraint transactions_source_check
  check (source in ('manual', 'ai_receipt', 'ai_email', 'ai_chat'));
