-- Paid access and super-admin controls for SD Dialer AI calls.
create table if not exists public.voice_call_agent_configs (
  agent_id text primary key,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_call_access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_by uuid not null references auth.users(id),
  target_user_id uuid references auth.users(id),
  company_id uuid references public.companies(id),
  duration_days integer not null check (duration_days between 1 and 3650),
  max_uses integer not null default 1 check (max_uses = 1),
  uses_count integer not null default 0 check (uses_count between 0 and max_uses),
  code_expires_at timestamptz,
  used_by uuid references auth.users(id),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists voice_call_access_codes_target_idx
  on public.voice_call_access_codes(target_user_id, created_at desc);

create table if not exists public.voice_call_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  status text not null default 'active' check (status in ('active', 'revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source_code_id uuid references public.voice_call_access_codes(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voice_call_agent_configs enable row level security;
alter table public.voice_call_access_codes enable row level security;
alter table public.voice_call_subscriptions enable row level security;

revoke all on table public.voice_call_agent_configs from public, anon, authenticated;
revoke all on table public.voice_call_access_codes from public, anon, authenticated;
revoke all on table public.voice_call_subscriptions from public, anon, authenticated;
grant all on table public.voice_call_agent_configs to service_role;
grant all on table public.voice_call_access_codes to service_role;
grant all on table public.voice_call_subscriptions to service_role;

create or replace function public.redeem_voice_call_access_code(
  p_code_hash text,
  p_user_id uuid,
  p_company_id uuid
) returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code_id uuid;
  v_duration_days integer;
  v_expires_at timestamptz;
begin
  update public.voice_call_access_codes c
  set uses_count = c.uses_count + 1,
      used_by = p_user_id,
      redeemed_at = now()
  where c.code_hash = p_code_hash
    and c.revoked_at is null
    and c.uses_count < c.max_uses
    and (c.code_expires_at is null or c.code_expires_at > now())
    and (c.target_user_id is null or c.target_user_id = p_user_id)
    and (c.company_id is null or c.company_id = p_company_id)
  returning c.id, c.duration_days into v_code_id, v_duration_days;

  if v_code_id is null then
    raise exception 'Código inválido, expirado, utilizado ou destinado a outra conta.';
  end if;

  insert into public.voice_call_subscriptions (
    user_id, company_id, status, starts_at, expires_at, source_code_id, updated_by
  ) values (
    p_user_id, p_company_id, 'active', now(),
    now() + make_interval(days => v_duration_days),
    v_code_id, p_user_id
  )
  on conflict (user_id) do update
    set company_id = excluded.company_id,
        status = 'active',
        starts_at = case
          when public.voice_call_subscriptions.status = 'active'
            and public.voice_call_subscriptions.expires_at > now()
          then public.voice_call_subscriptions.starts_at
          else now()
        end,
        expires_at = greatest(public.voice_call_subscriptions.expires_at, now())
          + make_interval(days => v_duration_days),
        source_code_id = excluded.source_code_id,
        updated_by = p_user_id,
        updated_at = now()
  returning expires_at into v_expires_at;

  return v_expires_at;
end;
$$;

revoke all on function public.redeem_voice_call_access_code(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.redeem_voice_call_access_code(text, uuid, uuid) to service_role;
