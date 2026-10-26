-- Explicit, server-managed permission to reuse the configured central caller ID.
-- The number itself remains in the server environment and is never copied here.
alter table public.voice_call_subscriptions
  add column if not exists use_system_caller_id boolean not null default false;

comment on column public.voice_call_subscriptions.use_system_caller_id is
  'Server-managed authorization to use LUMIN_CALLER_ID while the subscription is active. Never editable by clients.';
