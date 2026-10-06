create table if not exists public.venda_signature_requests (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'expired', 'revoked')),
  expires_at timestamptz not null,
  consent_accepted boolean not null default false,
  consent_version text not null default 'v1',
  consent_text text,
  signature_path text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venda_signature_requests_venda_created_idx
  on public.venda_signature_requests (venda_id, created_at desc);

create table if not exists public.venda_signature_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.venda_signature_requests(id) on delete cascade,
  file_type text not null
    check (file_type in ('identificacao', 'comprovativo_morada', 'fatura', 'outro', 'assinatura')),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 180),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  content_type text not null
    check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  uploaded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists venda_signature_files_request_created_idx
  on public.venda_signature_files (request_id, created_at);

alter table public.venda_signature_requests enable row level security;
alter table public.venda_signature_files enable row level security;

revoke all on public.venda_signature_requests from anon, authenticated;
revoke all on public.venda_signature_files from anon, authenticated;
grant all on public.venda_signature_requests to service_role;
grant all on public.venda_signature_files to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venda-assinaturas',
  'venda-assinaturas',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
