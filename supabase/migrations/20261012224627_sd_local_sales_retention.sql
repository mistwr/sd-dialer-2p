alter table public.vendas
  add column if not exists fidelizacao_inicio date,
  add column if not exists fidelizacao_meses integer check (fidelizacao_meses between 1 and 60),
  add column if not exists fidelizacao_fim date,
  add column if not exists cc_status text not null default 'pendente' check (cc_status in ('pendente','recebido','validado'));
create index if not exists vendas_company_nif_idx on public.vendas(company_id,client_nif) where client_nif is not null;
create index if not exists vendas_fidelizacao_fim_idx on public.vendas(fidelizacao_fim) where fidelizacao_fim is not null;
alter table public.notificacoes add column if not exists event_key text;
create unique index if not exists notificacoes_user_event_idx on public.notificacoes(user_id,event_key) where event_key is not null;

create schema if not exists sd_internal;
revoke all on schema sd_internal from public, anon, authenticated;
-- Internal triggers/jobs deliver notifications to sellers and authorised company admins.
-- No exposed RPC and no customer data are returned to callers.
create or replace function sd_internal.sale_notification(sale_id uuid, event text, heading text, content text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notificacoes(user_id,type,title,message,data,event_key)
  select u.id,'sistema',heading,content,jsonb_build_object('venda_id',v.id,'href','/parceiro/vendas'),event
  from public.vendas v join public.usuarios u on u.company_id=v.company_id
  where v.id=sale_id and u.status='active' and (
    u.id=v.seller_id or (u.role='admin' and (
      not coalesce(u.restricted_admin,false) or exists (
        select 1 from public.usuarios s where s.id=v.seller_id and
        (s.supervisor_id=u.id or (s.supervisor_id is null and s.created_by=u.id))
      )
    ))
  ) on conflict (user_id,event_key) where event_key is not null do nothing;
$$;
revoke all on function sd_internal.sale_notification(uuid,text,text,text) from public,anon,authenticated;

create or replace function sd_internal.notify_sale_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform sd_internal.sale_notification(new.id,'sale:'||new.id,'Nova venda registada','Uma nova venda está disponível no SD Dialer.');
  if new.cc_status='pendente' then
    perform sd_internal.sale_notification(new.id,'cc:'||new.id,'Identificação pendente','Verifica o estado do Cartão de Cidadão desta venda.');
  end if;
  return new;
end;
$$;
revoke all on function sd_internal.notify_sale_created() from public,anon,authenticated;
create trigger sd_notify_sale_created after insert on public.vendas for each row execute function sd_internal.notify_sale_created();

create or replace function sd_internal.notify_signature_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='pending' and TG_OP='INSERT' then
    perform sd_internal.sale_notification(new.venda_id,'signature-pending:'||new.id,'Assinatura pendente','O link de assinatura está pronto para enviar ao cliente.');
  elsif new.status='completed' and old.status is distinct from 'completed' then
    if exists(select 1 from public.venda_signature_files f where f.request_id=new.id and f.file_type='identificacao' and f.uploaded_at is not null) then
      update public.vendas set cc_status='recebido' where id=new.venda_id and cc_status='pendente';
    end if;
    perform sd_internal.sale_notification(new.venda_id,'signature-complete:'||new.id,'Cliente assinou','A assinatura e os anexos recebidos estão disponíveis na venda.');
  end if;
  return new;
end;
$$;
revoke all on function sd_internal.notify_signature_status() from public,anon,authenticated;
create trigger sd_notify_signature_status after insert or update of status on public.venda_signature_requests for each row execute function sd_internal.notify_signature_status();

create or replace function sd_internal.renewal_alerts()
returns void language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  for v in select id,fidelizacao_fim from public.vendas
    where fidelizacao_fim is not null and fidelizacao_fim - interval '2 months' <= current_date
    and status not in ('cancelado','cancelada')
  loop
    perform sd_internal.sale_notification(v.id,'renewal:'||v.id||':'||v.fidelizacao_fim,'Fidelização a terminar','Consulta a aba Fidelizações e agenda o contacto para renovação.');
  end loop;
  for v in select venda_id,id from public.venda_signature_requests where status='pending' and expires_at<=now()
  loop
    perform sd_internal.sale_notification(v.venda_id,'signature-expired:'||v.id,'Link de assinatura expirado','O cliente ainda não concluiu. Gera um novo link na venda.');
  end loop;
end;
$$;
revoke all on function sd_internal.renewal_alerts() from public,anon,authenticated;
select cron.schedule('sd-renewal-alerts','0 8 * * *','select sd_internal.renewal_alerts()');
