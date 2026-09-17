-- Guarda una edición/borrado en bulk propuesta por el bot de Telegram
-- mientras espera que la persona confirme (SI/NO) en el chat. Un solo
-- pendiente por chat a la vez (chat_id como primary key). Ver
-- app/api/telegram-webhook/route.ts.
create table if not exists bot_pending_actions (
  chat_id text primary key,
  action_type text not null check (action_type in ('bulk_edit', 'bulk_delete')),
  transaction_ids uuid[] not null,
  changes jsonb,
  summary text not null,
  created_at timestamptz not null default now()
);
