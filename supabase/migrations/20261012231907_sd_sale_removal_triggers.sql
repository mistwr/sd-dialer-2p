create or replace function sd_internal.handle_sale_removal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is distinct from old.deleted_at or (old.fidelizacao_fim is not null and new.fidelizacao_fim is null) then
    if auth.uid() is not null and not exists(select 1 from public.usuarios u where u.id=auth.uid() and u.role='admin' and u.status='active') then
      raise exception 'Apenas administradores podem apagar registos.' using errcode='42501';
    end if;
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    update public.venda_signature_requests set status='revoked' where venda_id=new.id and status in ('pending','processing');
    delete from public.notificacoes where data->>'venda_id'=new.id::text;
  elsif old.fidelizacao_fim is not null and new.fidelizacao_fim is null then
    delete from public.notificacoes where data->>'venda_id'=new.id::text and event_key like 'renewal:'||new.id||':%';
  end if;
  return new;
end;
$$;
revoke all on function sd_internal.handle_sale_removal() from public,anon,authenticated;
create trigger sd_handle_sale_removal after update of deleted_at,fidelizacao_fim on public.vendas for each row execute function sd_internal.handle_sale_removal();
