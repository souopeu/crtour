-- LGPD: the agency owner can delete the whole account. Removes the agency and everything under it
-- (clients, tags, notes, imports) and the login of every member. SECURITY DEFINER because deleting
-- from auth.users is not allowed to app roles; the owner check happens inside.
create function public.excluir_minha_conta() returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
  v_usuarios uuid[];
begin
  select m.agencia_id into v_agencia
  from public.membros m
  where m.user_id = (select auth.uid()) and m.papel = 'dono';
  if v_agencia is null then
    raise exception 'Só o dono da agência pode excluir a conta' using errcode = '42501';
  end if;

  select array_agg(m.user_id) into v_usuarios from public.membros m where m.agencia_id = v_agencia;

  delete from public.agencias where id = v_agencia;          -- cascades to all agency data and members
  delete from auth.users where id = any (v_usuarios);
end;
$$;

revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
