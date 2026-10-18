-- Adds an existing user (who already signed up) to another agency as a seller.
-- Run in the Supabase SQL editor (admin role). Entrega 1 has no invite flow yet.
--
-- 1. The seller signs up normally at /cadastro (this creates her own empty agency).
-- 2. Fill the two e-mails below and run the whole script in one go.
do $$
declare
  v_email_dono  text := 'dono@agencia.com.br';      -- e-mail of the agency owner
  v_email_vend  text := 'vendedora@agencia.com.br'; -- e-mail of the seller (already signed up)
  v_agencia uuid;
  v_vend    uuid;
  v_antiga  uuid;
begin
  select m.agencia_id into v_agencia
    from public.membros m join auth.users u on u.id = m.user_id
    where lower(u.email) = lower(v_email_dono) and m.papel = 'dono';
  if v_agencia is null then raise exception 'Dono não encontrado: %', v_email_dono; end if;

  select u.id into v_vend from auth.users u where lower(u.email) = lower(v_email_vend);
  if v_vend is null then raise exception 'Vendedora ainda não se cadastrou: %', v_email_vend; end if;

  select m.agencia_id into v_antiga from public.membros m where m.user_id = v_vend;
  if v_antiga = v_agencia then raise exception 'Já faz parte desta agência'; end if;
  if exists (select 1 from public.clientes where agencia_id = v_antiga) then
    raise exception 'A agência criada no cadastro dela já tem clientes; não vou apagá-la';
  end if;

  -- Remove her empty agency (cascades to her membership), then attach her to the owner's agency.
  delete from public.agencias where id = v_antiga;
  insert into public.membros (user_id, agencia_id, papel, nome)
    select v_vend, v_agencia, 'vendedor',
           coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nome'), ''), split_part(u.email, '@', 1))
    from auth.users u where u.id = v_vend;
end $$;
