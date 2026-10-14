create table if not exists public.company_caller_ids (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  phone_number text not null check (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  friendly_name text not null default '',
  status text not null check (status in ('pending', 'verified')),
  verification_method text not null check (verification_method in ('sms', 'call', 'existing')),
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  expires_at timestamptz,
  constraint company_caller_ids_phone_unique unique (phone_number),
  constraint company_caller_ids_verification_state_check check (
    (status = 'pending' and verified_at is null and expires_at is not null)
    or (status = 'verified' and verified_at is not null and expires_at is null)
  )
);

create index if not exists company_caller_ids_company_status_idx
  on public.company_caller_ids(company_id, status, created_at desc);

alter table public.company_caller_ids enable row level security;

revoke all on table public.company_caller_ids from anon, authenticated;
grant all on table public.company_caller_ids to service_role;
