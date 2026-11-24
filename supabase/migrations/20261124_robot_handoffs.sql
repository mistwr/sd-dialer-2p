-- Fluxo robot -> vendedor (SD Dialer)
-- 1) O robot qualifica uma lead (interesse alto/médio) -> abre um "handoff".
-- 2) A lead vai automaticamente para o vendedor ativo da empresa com menos leads do robot por tratar.
-- 3) O vendedor tem um prazo (30 min, dentro do horário de trabalho) para ligar.
-- 4) Se não ligar a tempo, passa ao vendedor seguinte (até N vezes) e o admin é avisado.
-- 5) A chamada do vendedor (call_history) fecha o prazo; o resultado fica registado (contactada / venda / perdida).
-- Tudo corre na base de dados (triggers + pg_cron), por isso funciona mesmo sem ninguém com o site aberto.

create extension if not exists pg_cron;

create table if not exists public.robot_handoff_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  ativo boolean not null default true,
  sla_minutos integer not null default 30 check (sla_minutos between 5 and 1440),
  hora_inicio smallint not null default 9 check (hora_inicio between 0 and 23),
  hora_fim smallint not null default 20 check (hora_fim between 1 and 24),
  dias smallint[] not null default '{1,2,3,4,5,6}',   -- 1 = segunda ... 7 = domingo
  max_reatribuicoes integer not null default 2 check (max_reatribuicoes between 0 and 10),
  excluidos uuid[] not null default '{}',              -- vendedores que não recebem leads do robot
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.robot_handoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  voice_call_id uuid,
  nivel text,
  estado text not null default 'pendente'
    check (estado in ('pendente', 'atribuida', 'contactada', 'venda', 'perdida', 'sem_vendedor', 'cancelada')),
  assigned_to uuid references public.usuarios(id) on delete set null,
  assigned_at timestamptz,
  prazo timestamptz,
  contactada_em timestamptz,
  resultado text,
  reatribuicoes integer not null default 0,
  admin_avisado boolean not null default false,
  historico jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists robot_handoffs_lead_ativo
  on public.robot_handoffs (lead_id) where estado in ('pendente', 'atribuida', 'sem_vendedor');
create index if not exists robot_handoffs_company_created on public.robot_handoffs (company_id, created_at desc);
create index if not exists robot_handoffs_assigned on public.robot_handoffs (assigned_to, estado);
create index if not exists robot_handoffs_prazo on public.robot_handoffs (prazo) where estado = 'atribuida';

alter table public.robot_handoffs enable row level security;
alter table public.robot_handoff_settings enable row level security;

drop policy if exists robot_handoffs_select on public.robot_handoffs;
create policy robot_handoffs_select on public.robot_handoffs for select to authenticated using (
  assigned_to = auth.uid()
  or exists (select 1 from public.usuarios u where u.id = auth.uid()
             and (u.is_super_admin = true or (u.company_id = robot_handoffs.company_id and u.role in ('admin', 'supervisor'))))
);
drop policy if exists robot_handoff_settings_select on public.robot_handoff_settings;
create policy robot_handoff_settings_select on public.robot_handoff_settings for select to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid()
          and (u.is_super_admin = true or u.company_id = robot_handoff_settings.company_id))
);
-- Escritas só pelo servidor (service role) e pelas funções abaixo.

-- Definições efetivas (com valores por defeito se a empresa ainda não tiver linha).
create or replace function public.robot_cfg(p_company uuid)
returns public.robot_handoff_settings
language plpgsql stable security definer set search_path = public as $$
declare s public.robot_handoff_settings;
begin
  select * into s from public.robot_handoff_settings where company_id = p_company;
  if not found then
    s.company_id := p_company; s.ativo := true; s.sla_minutos := 30; s.hora_inicio := 9; s.hora_fim := 20;
    s.dias := '{1,2,3,4,5,6}'; s.max_reatribuicoes := 2; s.excluidos := '{}';
  end if;
  return s;
end $$;

-- Prazo: a partir de p_desde, conta sla_minutos só dentro do horário de trabalho (hora de Lisboa).
create or replace function public.robot_prazo(p_company uuid, p_desde timestamptz default now())
returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  s public.robot_handoff_settings := public.robot_cfg(p_company);
  t timestamp := (p_desde at time zone 'Europe/Lisbon');
  restante integer := s.sla_minutos;
  fim_dia timestamp; abre timestamp; disp integer; i integer := 0;
begin
  if s.hora_fim <= s.hora_inicio then return p_desde + make_interval(mins => s.sla_minutos); end if;
  while restante > 0 and i < 30 loop
    i := i + 1;
    abre := date_trunc('day', t) + make_interval(hours => s.hora_inicio);
    fim_dia := date_trunc('day', t) + make_interval(hours => s.hora_fim);
    if not (extract(isodow from t)::smallint = any (s.dias)) or t >= fim_dia then
      t := date_trunc('day', t) + interval '1 day' + make_interval(hours => s.hora_inicio);
      continue;
    end if;
    if t < abre then t := abre; end if;
    disp := floor(extract(epoch from (fim_dia - t)) / 60);
    if disp >= restante then
      t := t + make_interval(mins => restante); restante := 0;
    else
      restante := restante - disp;
      t := date_trunc('day', t) + interval '1 day' + make_interval(hours => s.hora_inicio);
    end if;
  end loop;
  return t at time zone 'Europe/Lisbon';
end $$;

-- Vendedor com menos leads do robot por tratar (empate: quem recebeu há mais tempo).
create or replace function public.robot_escolher_vendedor(p_company uuid, p_excluir uuid[] default '{}')
returns uuid
language sql stable security definer set search_path = public as $$
  select u.id
  from public.usuarios u
  where u.company_id = p_company
    and u.role = 'parceiro'
    and coalesce(u.status, 'active') = 'active'
    and not (u.id = any (coalesce(p_excluir, '{}')))
    and not (u.id = any ((public.robot_cfg(p_company)).excluidos))
  order by
    (select count(*) from public.robot_handoffs h where h.assigned_to = u.id and h.estado = 'atribuida') asc,
    (select max(h.assigned_at) from public.robot_handoffs h where h.assigned_to = u.id) asc nulls first,
    random()
  limit 1
$$;

create or replace function public.robot_avisar_gestores(p_company uuid, p_titulo text, p_msg text, p_data jsonb)
returns void
language sql security definer set search_path = public as $$
  insert into public.notificacoes (user_id, type, title, message, data)
  select u.id, 'sistema', p_titulo, p_msg, p_data
  from public.usuarios u
  where u.company_id = p_company and u.role in ('admin', 'supervisor') and coalesce(u.status, 'active') = 'active'
$$;

-- Atribui (ou reatribui) um handoff. p_motivo: 'robot', 'prazo', 'manual'.
create or replace function public.robot_atribuir(p_handoff uuid, p_motivo text default 'robot', p_para uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  h public.robot_handoffs;
  anteriores uuid[];
  novo uuid;
  nome_lead text;
  agora timestamptz := now();
begin
  select * into h from public.robot_handoffs where id = p_handoff for update;
  if not found or h.estado not in ('pendente', 'atribuida', 'sem_vendedor') then return null; end if;

  select coalesce(array_agg((e->>'vendedor')::uuid) filter (where e ? 'vendedor'), '{}')
    into anteriores from jsonb_array_elements(h.historico) e;
  if h.assigned_to is not null then anteriores := array_append(anteriores, h.assigned_to); end if;

  novo := coalesce(p_para, public.robot_escolher_vendedor(h.company_id, case when p_motivo = 'robot' then '{}'::uuid[] else anteriores end));
  -- Se já todos receberam esta lead, volta a escolher entre todos menos o atual.
  if novo is null and p_motivo <> 'robot' and h.assigned_to is not null then
    novo := public.robot_escolher_vendedor(h.company_id, array[h.assigned_to]);
  end if;

  select nome into nome_lead from public.leads where id = h.lead_id;

  if novo is null then
    update public.robot_handoffs set estado = 'sem_vendedor', updated_at = agora,
      historico = historico || jsonb_build_object('em', agora, 'evento', 'sem_vendedor', 'motivo', p_motivo)
    where id = h.id;
    if not h.admin_avisado then
      perform public.robot_avisar_gestores(h.company_id, 'Lead do robot sem vendedor',
        coalesce(nome_lead, 'Lead') || ' mostrou interesse mas não há vendedores ativos para a receber.',
        jsonb_build_object('lead_id', h.lead_id, 'handoff_id', h.id));
      update public.robot_handoffs set admin_avisado = true where id = h.id;
    end if;
    return null;
  end if;

  update public.leads set assigned_to = novo, updated_at = agora where id = h.lead_id;
  update public.robot_handoffs set
    estado = 'atribuida', assigned_to = novo, assigned_at = agora,
    prazo = public.robot_prazo(h.company_id, agora),
    reatribuicoes = h.reatribuicoes + case when p_motivo = 'robot' or h.assigned_to is null then 0 else 1 end,
    historico = historico || jsonb_build_object('em', agora, 'evento', 'atribuida', 'vendedor', novo, 'motivo', p_motivo, 'anterior', h.assigned_to),
    updated_at = agora
  where id = h.id;

  insert into public.notificacoes (user_id, type, title, message, data)
  values (novo, 'nova_lead',
    case when p_motivo = 'prazo' then 'Lead quente passada para ti' else 'Nova lead quente do robot' end,
    coalesce(nome_lead, 'Uma lead') || ' tem interesse ' || coalesce(h.nivel, '') || '. Liga dentro do prazo: está em Minhas Leads.',
    jsonb_build_object('lead_id', h.lead_id, 'handoff_id', h.id));
  return novo;
end $$;

-- Trigger: o robot qualificou -> abre handoff e atribui.
create or replace function public.robot_on_voice_call()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.robot_handoff_settings;
  hid uuid;
  dono uuid;
begin
  if new.lead_id is null or new.company_id is null then return new; end if;
  if coalesce(new.interest_level, '') not in ('alto', 'medio') then return new; end if;
  if coalesce(new.source, '') = 'sd-dialer-human' or coalesce(new.conversation_state->>'mode', '') = 'human' then return new; end if;
  if tg_op = 'UPDATE' and old.interest_level is not distinct from new.interest_level then return new; end if;

  s := public.robot_cfg(new.company_id);
  if not s.ativo then return new; end if;

  -- Já há um handoff em curso para esta lead: só atualiza o nível.
  update public.robot_handoffs set nivel = new.interest_level, voice_call_id = new.id, updated_at = now()
   where lead_id = new.lead_id and estado in ('pendente', 'atribuida', 'sem_vendedor')
  returning id into hid;
  if hid is not null then return new; end if;

  insert into public.robot_handoffs (company_id, lead_id, voice_call_id, nivel, historico)
  values (new.company_id, new.lead_id, new.id, new.interest_level,
          jsonb_build_array(jsonb_build_object('em', now(), 'evento', 'qualificada', 'nivel', new.interest_level)))
  returning id into hid;

  -- Se a lead já é de um vendedor ativo, fica com ele (com prazo); senão distribui.
  select l.assigned_to into dono from public.leads l
    join public.usuarios u on u.id = l.assigned_to
   where l.id = new.lead_id and u.role = 'parceiro' and coalesce(u.status, 'active') = 'active'
     and not (u.id = any (s.excluidos));
  perform public.robot_atribuir(hid, 'robot', dono);
  return new;
exception when others then
  -- Nunca bloquear a gravação da chamada do robot.
  raise warning 'robot_on_voice_call: %', sqlerrm;
  return new;
end $$;

drop trigger if exists trg_robot_on_voice_call on public.voice_calls;
create trigger trg_robot_on_voice_call
  after insert or update of interest_level on public.voice_calls
  for each row execute function public.robot_on_voice_call();

-- Trigger: o vendedor ligou -> fecha o prazo e regista o resultado.
create or replace function public.robot_on_call_history()
returns trigger
language plpgsql security definer set search_path = public as $$
declare h public.robot_handoffs; novo_estado text;
begin
  select * into h from public.robot_handoffs
   where lead_id = new.lead_id and estado in ('atribuida', 'contactada')
   order by created_at desc limit 1;
  if not found then return new; end if;
  if h.assigned_to is distinct from new.parceiro_id then return new; end if;

  novo_estado := case
    when new.result::text = 'venda' then 'venda'
    when new.result::text in ('nao_interessado', 'numero_errado', 'numero_nao_atribuido', 'pertence_outra_pessoa') then 'perdida'
    else 'contactada' end;

  update public.robot_handoffs set
    estado = case when h.estado = 'contactada' and novo_estado = 'contactada' then 'contactada' else novo_estado end,
    contactada_em = coalesce(contactada_em, coalesce(new.called_at, now())),
    resultado = new.result::text,
    historico = historico || jsonb_build_object('em', now(), 'evento', 'chamada', 'vendedor', new.parceiro_id, 'resultado', new.result::text),
    updated_at = now()
  where id = h.id;
  return new;
exception when others then
  raise warning 'robot_on_call_history: %', sqlerrm;
  return new;
end $$;

drop trigger if exists trg_robot_on_call_history on public.call_history;
create trigger trg_robot_on_call_history
  after insert on public.call_history
  for each row execute function public.robot_on_call_history();

-- Cron: prazos ultrapassados -> passa ao seguinte; leads sem vendedor -> tenta outra vez.
create or replace function public.robot_verificar_prazos()
returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; s public.robot_handoff_settings; novo uuid; nome_lead text; nome_vend text;
begin
  for r in
    select * from public.robot_handoffs
     where estado = 'atribuida' and contactada_em is null and prazo < now()
     order by prazo limit 200
  loop
    s := public.robot_cfg(r.company_id);
    select nome into nome_lead from public.leads where id = r.lead_id;
    select full_name into nome_vend from public.usuarios where id = r.assigned_to;
    if not s.ativo then continue; end if;
    if r.reatribuicoes < s.max_reatribuicoes then
      novo := public.robot_atribuir(r.id, 'prazo');
      if novo is not null then
        n := n + 1;
        insert into public.notificacoes (user_id, type, title, message, data)
        values (r.assigned_to, 'sistema', 'Lead do robot passada a um colega',
                coalesce(nome_lead, 'A lead') || ' passou a outro vendedor porque o prazo terminou sem chamada.',
                jsonb_build_object('lead_id', r.lead_id, 'handoff_id', r.id));
        perform public.robot_avisar_gestores(r.company_id, 'Prazo ultrapassado numa lead do robot',
          coalesce(nome_vend, 'O vendedor') || ' não ligou a tempo a ' || coalesce(nome_lead, 'uma lead') || '. Passou a outro vendedor.',
          jsonb_build_object('lead_id', r.lead_id, 'handoff_id', r.id));
      end if;
    elsif not r.admin_avisado then
      perform public.robot_avisar_gestores(r.company_id, 'Lead do robot por tratar',
        coalesce(nome_lead, 'Uma lead') || ' já passou por ' || (r.reatribuicoes + 1) || ' vendedores sem chamada. Precisa de ti.',
        jsonb_build_object('lead_id', r.lead_id, 'handoff_id', r.id));
      update public.robot_handoffs set admin_avisado = true, updated_at = now() where id = r.id;
    end if;
  end loop;

  for r in select id from public.robot_handoffs where estado = 'sem_vendedor' order by created_at limit 100 loop
    if public.robot_atribuir(r.id, 'robot') is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

revoke all on function public.robot_atribuir(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.robot_verificar_prazos() from public, anon, authenticated;
revoke all on function public.robot_avisar_gestores(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.robot_escolher_vendedor(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.robot_atribuir(uuid, text, uuid) to service_role;
grant execute on function public.robot_verificar_prazos() to service_role;

do $$ begin
  perform cron.unschedule('robot-verificar-prazos');
exception when others then null; end $$;
select cron.schedule('robot-verificar-prazos', '*/2 * * * *', $$select public.robot_verificar_prazos()$$);
