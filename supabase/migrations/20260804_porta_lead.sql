-- ===========================================================================
-- SD DIALER — "Porta → Lead" (Captação de Porta)
-- Aplicada diretamente no projeto Supabase em produção via MCP.
-- Este ficheiro documenta a migração para histórico e reprodutibilidade.
-- ===========================================================================

create table door_captures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  comercial_id uuid not null references usuarios(id) on delete restrict,
  campanha_id uuid references campanhas(id) on delete set null,

  -- ETAPA 1 — Dados do contacto
  nome text not null,
  telefone text not null,
  email text,
  tipo_cliente text not null default 'particular' check (tipo_cliente in ('particular','empresa')),
  nif text,
  morada text,
  codigo_postal text,
  localidade text,
  distrito text,
  latitude numeric,
  longitude numeric,
  consentimento_rgpd boolean not null default false,
  data_consentimento timestamptz,

  -- ETAPA 2 — Telecomunicações
  tc_operador_atual text,
  tc_tem_tv boolean,
  tc_tem_internet boolean,
  tc_tem_fixo boolean,
  tc_num_cartoes_moveis smallint,
  tc_mensalidade numeric,
  tc_velocidade_internet text,
  tc_fim_fidelizacao date,
  tc_satisfacao smallint check (tc_satisfacao between 1 and 5),
  tc_problemas text[] not null default '{}',
  tc_interesse_comparacao boolean,

  -- ETAPA 3 — Energia
  en_comercializador_atual text,
  en_tipo text check (en_tipo in ('eletricidade','gas','ambos')),
  en_potencia_contratada text,
  en_tipo_tarifa text,
  en_valor_medio_mensal numeric,
  en_fim_contrato date,
  en_interesse text[] not null default '{}',

  -- ETAPA 4 — Qualificação
  interesse text check (interesse in ('telecomunicacoes','energia','ambos')),
  temperatura text check (temperatura in ('quente','morna','fria')),
  melhor_horario text,
  notas text,
  resultado text check (resultado in ('interessado','follow_up','sem_interesse','ja_cliente','venda')),
  proxima_acao text,
  data_proximo_contacto date,

  -- Lead score (regras simples e explicáveis, não é ML)
  score smallint not null default 0,
  score_motivos text[] not null default '{}',

  -- Deduplicação
  duplicado_de_lead_id uuid references leads(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_door_captures_company on door_captures(company_id);
create index idx_door_captures_comercial on door_captures(comercial_id);
create index idx_door_captures_lead on door_captures(lead_id);
create index idx_door_captures_created_at on door_captures(created_at);
create index idx_door_captures_codigo_postal on door_captures(codigo_postal);

-- Anexos (fotografia/PDF de fatura)
create table door_capture_attachments (
  id uuid primary key default gen_random_uuid(),
  door_capture_id uuid not null references door_captures(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  tipo text not null check (tipo in ('fatura_telecom','fatura_energia','outro')),
  storage_path text not null,
  file_name text,
  file_size bigint,
  content_type text,
  uploaded_by uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_door_capture_attachments_capture on door_capture_attachments(door_capture_id);

-- Timeline genérica de atividades da lead (reutilizável para além da captação de porta)
create table lead_timeline (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  tipo text not null check (tipo in ('porta','chamada','follow_up','nota','sistema')),
  descricao text not null,
  usuario_id uuid references usuarios(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_lead_timeline_lead on lead_timeline(lead_id);

-- ===========================================================================
-- RLS — mesmo padrão das tabelas existentes (leads)
-- ===========================================================================
alter table door_captures enable row level security;
alter table door_capture_attachments enable row level security;
alter table lead_timeline enable row level security;

create policy door_captures_select on door_captures for select
  using (
    (company_id = get_my_company_id() and get_my_role() = any(array['admin','supervisor']))
    or comercial_id = auth.uid()
    or get_is_super_admin()
  );

create policy door_captures_insert on door_captures for insert
  with check (
    company_id = get_my_company_id()
    and (comercial_id = auth.uid() or get_my_role() = any(array['admin','supervisor']))
  );

create policy door_captures_update on door_captures for update
  using (
    (company_id = get_my_company_id() and get_my_role() = any(array['admin','supervisor']))
    or comercial_id = auth.uid()
    or get_is_super_admin()
  );

create policy door_captures_delete on door_captures for delete
  using (get_my_role() = 'admin' and company_id = get_my_company_id());

create policy door_capture_attachments_select on door_capture_attachments for select
  using (
    exists (
      select 1 from door_captures dc
      where dc.id = door_capture_attachments.door_capture_id
      and (
        (dc.company_id = get_my_company_id() and get_my_role() = any(array['admin','supervisor']))
        or dc.comercial_id = auth.uid()
        or get_is_super_admin()
      )
    )
  );

create policy door_capture_attachments_insert on door_capture_attachments for insert
  with check (company_id = get_my_company_id());

create policy lead_timeline_select on lead_timeline for select
  using (company_id = get_my_company_id() or get_is_super_admin());

create policy lead_timeline_insert on lead_timeline for insert
  with check (company_id = get_my_company_id());

-- ===========================================================================
-- Storage bucket privado para faturas/anexos
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('door-captures', 'door-captures', false)
on conflict (id) do nothing;

create policy door_captures_storage_read on storage.objects for select
  using (
    bucket_id = 'door-captures'
    and (storage.foldername(name))[1] = get_my_company_id()::text
  );

create policy door_captures_storage_write on storage.objects for insert
  with check (
    bucket_id = 'door-captures'
    and (storage.foldername(name))[1] = get_my_company_id()::text
  );

create policy door_captures_storage_delete on storage.objects for delete
  using (
    bucket_id = 'door-captures'
    and (storage.foldername(name))[1] = get_my_company_id()::text
    and get_my_role() = any(array['admin','supervisor'])
  );
