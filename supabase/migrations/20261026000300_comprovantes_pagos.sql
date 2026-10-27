-- E10 security review: receipts of payments the agency made (E10-2) share the bucket with the receipts of payments
-- received, under <agencia>/pagos/. The folder rule let any member list, download and delete them; that folder is
-- now the owner's only (R144). Other folders keep the rule of spec 18.
create function private.pode_comprovante(p_nome text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros m
    where m.user_id = (select auth.uid())
      and m.agencia_id::text = (storage.foldername(p_nome))[1]
      and ((storage.foldername(p_nome))[2] is distinct from 'pagos' or m.papel = 'dono'));
$$;
revoke all on function private.pode_comprovante(text) from public, anon;
grant execute on function private.pode_comprovante(text) to authenticated;

drop policy comprovantes_ler on storage.objects;
drop policy comprovantes_enviar on storage.objects;
drop policy comprovantes_apagar on storage.objects;
create policy comprovantes_ler on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and private.pode_comprovante(name));
create policy comprovantes_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and array_length(storage.foldername(name), 1) = 2 and private.pode_comprovante(name));
create policy comprovantes_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes' and private.pode_comprovante(name));
