-- Deleting the agency cascades to tours and departures in separate steps, and the departures ->
-- tours foreign key would still see the other side. Removing departures first avoids it.
create or replace function public.excluir_minha_conta() returns void
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

  delete from public.saidas where agencia_id = v_agencia;     -- before tours (foreign key order)
  delete from public.agencias where id = v_agencia;           -- cascades to the rest and to members
  delete from auth.users where id = any (v_usuarios);
end;
$$;
