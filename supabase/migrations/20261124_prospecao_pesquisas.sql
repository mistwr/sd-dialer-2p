create table if not exists public.prospecao_pesquisas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid not null,
  query text not null,
  local text,
  raio_km int,
  created_at timestamptz not null default now()
);
create index if not exists prospecao_pesquisas_user_idx on public.prospecao_pesquisas (user_id, created_at desc);
alter table public.prospecao_pesquisas enable row level security;
