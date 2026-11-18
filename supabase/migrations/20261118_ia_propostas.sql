-- Propostas de melhoria feitas pela IA central. Nada é aplicado automaticamente: ficam pendentes até um admin decidir.
create table if not exists public.ia_propostas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  criado_por uuid not null,
  tipo text not null default 'outro',
  titulo text not null,
  texto_proposto text not null,
  motivo text,
  estado text not null default 'pendente' check (estado in ('pendente','aprovada','rejeitada','aplicada')),
  decidido_por uuid,
  decidido_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ia_propostas_company_idx on public.ia_propostas (company_id, created_at desc);
alter table public.ia_propostas enable row level security;
-- Acesso só via API (service role). Sem políticas = sem acesso direto pelo cliente.
