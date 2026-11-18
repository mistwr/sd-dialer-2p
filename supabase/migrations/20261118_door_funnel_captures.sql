-- Funil AEDCRAFAM da porta: captura por fases, sem dados pessoais até ao Fechar.
create table if not exists public.door_funnel_captures (
  id uuid primary key,
  company_id uuid not null,
  comercial_id uuid not null,
  campanha_id uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fase_final text not null default 'abordar',
  resultado text,
  motivo_recusa text,
  latitude numeric,
  longitude numeric,
  reacao text,
  operadora text,
  valoriza text[] not null default '{}',
  dor text,
  mensalidade numeric,
  servicos jsonb not null default '{}'::jsonb,
  satisfacao smallint,
  fim_fidelizacao date,
  comparacao_feita boolean not null default false,
  diferenca_mensal_estimada numeric,
  proposta_apresentada boolean not null default false,
  notas text,
  door_capture_id uuid,
  referencia_consentida boolean not null default false,
  respostas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists door_funnel_captures_company_idx on public.door_funnel_captures (company_id, created_at desc);
create index if not exists door_funnel_captures_comercial_idx on public.door_funnel_captures (comercial_id, created_at desc);
alter table public.door_funnel_captures enable row level security;
create policy door_funnel_select on public.door_funnel_captures for select using (
  (company_id = get_my_company_id() and get_my_role() = any (array['admin','supervisor'])) or comercial_id = auth.uid() or get_is_super_admin());
create policy door_funnel_insert on public.door_funnel_captures for insert with check (
  company_id = get_my_company_id() and comercial_id = auth.uid());
create policy door_funnel_update on public.door_funnel_captures for update using (
  comercial_id = auth.uid() or (company_id = get_my_company_id() and get_my_role() = any (array['admin','supervisor'])) or get_is_super_admin());
create policy door_funnel_delete on public.door_funnel_captures for delete using (
  (get_my_role() = 'admin' and company_id = get_my_company_id()) or get_is_super_admin());
