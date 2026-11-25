create table if not exists public.ranking_config (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ranking_config enable row level security;
insert into public.ranking_config (chave, valor) values ('objetivo_diario_eur', '{"eur": 2000}') on conflict (chave) do nothing;

alter table public.ranking_ajustes add column if not exists dia date; -- vendas lançadas para um dia concreto (aparecem no painel Hoje)

-- Desafios relâmpago: "o primeiro a N chamadas/vendas até às HH:MM ganha X"
create table if not exists public.ranking_desafios (
  id uuid primary key default gen_random_uuid(),
  metrica text not null check (metrica in ('chamadas','vendas')),
  alvo int not null check (alvo > 0),
  premio text,
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  cancelado boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists ranking_desafios_fim_idx on public.ranking_desafios (fim desc);
alter table public.ranking_desafios enable row level security;
