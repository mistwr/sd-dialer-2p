-- Resultados lançados à mão no ranking (vendas feitas fora do SD Dialer ou de quem não tem conta).
create table if not exists public.ranking_ajustes (
  id uuid primary key default gen_random_uuid(),
  mes date not null,                 -- primeiro dia do mês a que os resultados pertencem
  user_id uuid references public.usuarios(id) on delete set null,
  nome text not null,
  tvs int not null default 0,
  energias int not null default 0,
  chamadas int not null default 0,
  nota text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists ranking_ajustes_mes_idx on public.ranking_ajustes (mes);
alter table public.ranking_ajustes enable row level security;
