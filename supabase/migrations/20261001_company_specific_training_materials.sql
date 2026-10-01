create table if not exists public.company_training_materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  operator text not null default 'Geral',
  category text not null default 'Geral',
  content text,
  url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_training_materials_company_idx
  on public.company_training_materials(company_id, is_active, sort_order, created_at);

alter table public.company_training_materials enable row level security;

drop policy if exists "company_training_select" on public.company_training_materials;
create policy "company_training_select"
  on public.company_training_materials
  for select
  to authenticated
  using (company_id = public.get_my_company_id());

drop policy if exists "company_training_insert_admin" on public.company_training_materials;
create policy "company_training_insert_admin"
  on public.company_training_materials
  for insert
  to authenticated
  with check (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'admin'
  );

drop policy if exists "company_training_update_admin" on public.company_training_materials;
create policy "company_training_update_admin"
  on public.company_training_materials
  for update
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'admin'
  )
  with check (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'admin'
  );

drop policy if exists "company_training_delete_admin" on public.company_training_materials;
create policy "company_training_delete_admin"
  on public.company_training_materials
  for delete
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'admin'
  );

grant select, insert, update, delete on table public.company_training_materials to authenticated;
