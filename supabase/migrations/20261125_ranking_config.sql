create table if not exists public.ranking_config (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ranking_config enable row level security;
insert into public.ranking_config (chave, valor) values ('objetivo_diario_eur', '{"eur": 2000}') on conflict (chave) do nothing;
