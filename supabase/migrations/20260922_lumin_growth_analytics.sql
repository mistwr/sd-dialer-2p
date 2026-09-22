-- LUMIN AI growth measurement
-- Stores aggregate, privacy-minimal conversion events. No IP, user-agent, email,
-- phone, cookie id, or persistent visitor identifier is stored.

insert into public.companies (name, status, plan)
select 'LUMIN AI', 'active'::company_status, 'enterprise'::company_plan
where not exists (
  select 1 from public.companies where lower(name) = lower('LUMIN AI')
);

create table if not exists public.lumin_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'page_view',
      'robot_click',
      'pro_click',
      'checkout_click',
      'whatsapp_click',
      'simulation_click',
      'analysis_click',
      'lead_submit'
    )
  ),
  page_path text not null default '/',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  referrer_domain text,
  created_at timestamptz not null default now()
);

alter table public.lumin_events enable row level security;
revoke all on table public.lumin_events from anon, authenticated;

create index if not exists lumin_events_created_at_idx on public.lumin_events(created_at desc);
create index if not exists lumin_events_event_type_idx on public.lumin_events(event_type);
create index if not exists lumin_events_utm_source_idx on public.lumin_events(utm_source);
