alter table public.vendas add column if not exists deleted_at timestamptz;
create or replace function sd_internal.renewal_alerts()
returns void language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  for v in select id,fidelizacao_fim from public.vendas
    where deleted_at is null and fidelizacao_fim is not null and fidelizacao_fim - interval '2 months' <= current_date
    and status not in ('cancelado','cancelada')
  loop
    perform sd_internal.sale_notification(v.id,'renewal:'||v.id||':'||v.fidelizacao_fim,'Fidelização a terminar','Consulta a aba Fidelizações e agenda o contacto para renovação.');
  end loop;
  for v in select r.venda_id,r.id from public.venda_signature_requests r join public.vendas s on s.id=r.venda_id where r.status='pending' and r.expires_at<=now() and s.deleted_at is null
  loop
    perform sd_internal.sale_notification(v.venda_id,'signature-expired:'||v.id,'Link de assinatura expirado','O cliente ainda não concluiu. Gera um novo link na venda.');
  end loop;
end;
$$;
revoke all on function sd_internal.renewal_alerts() from public,anon,authenticated;

