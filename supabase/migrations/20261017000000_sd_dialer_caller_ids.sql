create table if not exists public.sd_dialer_caller_ids (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  phone_number text not null check (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed')),
  is_active boolean not null default false,
  validation_code text check (
    validation_code is null or validation_code ~ '^[0-9]{4,8}$'
  ),
  twilio_call_sid text,
  twilio_outgoing_caller_id_sid text,
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists sd_dialer_caller_ids_phone_claim_idx
  on public.sd_dialer_caller_ids(phone_number)
  where verification_status in ('pending', 'verified');

create unique index if not exists sd_dialer_caller_ids_active_user_idx
  on public.sd_dialer_caller_ids(user_id)
  where is_active;

create unique index if not exists sd_dialer_caller_ids_pending_user_idx
  on public.sd_dialer_caller_ids(user_id)
  where verification_status = 'pending';

create index if not exists sd_dialer_caller_ids_user_status_idx
  on public.sd_dialer_caller_ids(user_id, company_id, verification_status, requested_at desc);

alter table public.sd_dialer_caller_ids enable row level security;
revoke all on table public.sd_dialer_caller_ids from public, anon, authenticated;
grant all on table public.sd_dialer_caller_ids to service_role;

comment on table public.sd_dialer_caller_ids is
  'Server-managed verified caller IDs for SD Dialer users. The temporary Twilio validation code is readable only by the gateway service role and is cleared after callback.';

create or replace function public.activate_sd_dialer_caller_id(
  p_verification_id uuid,
  p_twilio_sid text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_requested_at timestamptz;
begin
  select c.user_id, c.requested_at
    into v_user_id, v_requested_at
    from public.sd_dialer_caller_ids c
   where c.id = p_verification_id
     and c.verification_status = 'pending'
   for update;

  if not found then
    return;
  end if;

  -- Serialize callbacks for the same account and let the newest requested
  -- successful verification become active.
  perform 1
    from public.usuarios u
   where u.id = v_user_id
   for update;

  update public.sd_dialer_caller_ids c
     set verification_status = 'verified',
         twilio_outgoing_caller_id_sid = p_twilio_sid,
         verified_at = now(),
         validation_code = null,
         is_active = false
   where c.id = p_verification_id;

  if exists (
    select 1
      from public.sd_dialer_caller_ids newer
     where newer.user_id = v_user_id
       and newer.verification_status = 'pending'
       and newer.requested_at > v_requested_at
  ) then
    return;
  end if;

  update public.sd_dialer_caller_ids c
     set is_active = false
   where c.user_id = v_user_id
     and c.is_active;

  update public.sd_dialer_caller_ids c
     set is_active = true
   where c.id = p_verification_id;
end;
$$;

revoke all on function public.activate_sd_dialer_caller_id(uuid, text)
  from public, anon, authenticated;
grant execute on function public.activate_sd_dialer_caller_id(uuid, text)
  to service_role;
