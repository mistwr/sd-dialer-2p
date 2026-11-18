-- Última localização de cada utilizador (só a mais recente, sem histórico). Acesso só pela API.
create table if not exists public.user_locations (
  user_id uuid primary key,
  company_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  updated_at timestamptz not null default now()
);
create index if not exists user_locations_company_idx on public.user_locations (company_id, updated_at desc);
alter table public.user_locations enable row level security;
