-- ===========================================================================
-- CHAT INTERNO (comerciais/admin) — mensagens diretas e em grupo
-- Aplicada diretamente no projeto Supabase em produção via MCP.
-- ===========================================================================

create table conversas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tipo text not null default 'direta' check (tipo in ('direta', 'grupo')),
  nome text,
  created_by uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table conversa_participantes (
  conversa_id uuid not null references conversas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversa_id, usuario_id)
);

create table mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references conversas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  conteudo text not null,
  created_at timestamptz not null default now(),
  editado_at timestamptz,
  apagado boolean not null default false
);

create index idx_conversa_participantes_usuario on conversa_participantes(usuario_id);
create index idx_mensagens_conversa on mensagens(conversa_id, created_at);

create or replace function trg_conversa_touch()
returns trigger
language plpgsql
as $$
begin
  update conversas set updated_at = now() where id = new.conversa_id;
  return new;
end;
$$;

drop trigger if exists mensagem_touch_conversa on mensagens;
create trigger mensagem_touch_conversa
  after insert on mensagens
  for each row
  execute function trg_conversa_touch();

alter table conversas enable row level security;
alter table conversa_participantes enable row level security;
alter table mensagens enable row level security;

create policy conversas_select on conversas for select
  using (
    exists (select 1 from conversa_participantes cp where cp.conversa_id = conversas.id and cp.usuario_id = auth.uid())
    or get_is_super_admin()
  );

create policy conversas_insert on conversas for insert
  with check (company_id = get_my_company_id());

create policy conversa_participantes_select on conversa_participantes for select
  using (
    exists (select 1 from conversa_participantes cp2 where cp2.conversa_id = conversa_participantes.conversa_id and cp2.usuario_id = auth.uid())
    or get_is_super_admin()
  );

create policy conversa_participantes_insert on conversa_participantes for insert
  with check (
    exists (
      select 1 from conversas c
      where c.id = conversa_participantes.conversa_id and c.company_id = get_my_company_id()
    )
  );

create policy conversa_participantes_update on conversa_participantes for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy mensagens_select on mensagens for select
  using (
    exists (select 1 from conversa_participantes cp where cp.conversa_id = mensagens.conversa_id and cp.usuario_id = auth.uid())
    or get_is_super_admin()
  );

create policy mensagens_insert on mensagens for insert
  with check (
    usuario_id = auth.uid()
    and exists (select 1 from conversa_participantes cp where cp.conversa_id = mensagens.conversa_id and cp.usuario_id = auth.uid())
  );

create policy mensagens_update on mensagens for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

alter publication supabase_realtime add table mensagens;
