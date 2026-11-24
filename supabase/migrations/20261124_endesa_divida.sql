-- Consulta de dívida Endesa por NIF. Só via API (service role); sem políticas = sem acesso direto pelo cliente.
create table if not exists public.endesa_divida_nifs (
  company_id uuid not null,
  nif text not null,
  carga_id uuid not null,
  primary key (company_id, nif)
);
create table if not exists public.endesa_divida_cargas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  carregado_por uuid not null,
  ficheiro text,
  data_lista date,
  total integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.endesa_divida_consultas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null,
  nif_fim text,
  encontrado boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists endesa_divida_cargas_idx on public.endesa_divida_cargas (company_id, created_at desc);
create index if not exists endesa_divida_consultas_idx on public.endesa_divida_consultas (user_id, created_at desc);
alter table public.endesa_divida_nifs enable row level security;
alter table public.endesa_divida_cargas enable row level security;
alter table public.endesa_divida_consultas enable row level security;
