-- Audit: a logged-in member could call criar_cobranca_online directly and attach any https link to a reservation.
-- Creating a charge is now server-only (after the provider answered); the server says on whose behalf it acts.
drop function public.criar_cobranca_online(uuid, integer, text, text, text, timestamptz);

create function public.criar_cobranca_online(p_usuario uuid, p_reserva uuid, p_valor integer, p_provedor text, p_id_externo text, p_link text, p_vence_em timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_res public.reservas;
  v_pago bigint;
  v_id uuid;
begin
  select * into v_res from public.reservas where id = p_reserva;
  if not found or not exists (select 1 from public.membros m where m.user_id = p_usuario and m.agencia_id = v_res.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  if v_res.situacao <> 'ativa' then raise exception 'A reserva está cancelada' using errcode = 'CR006'; end if;
  select coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0) into v_pago from public.pagamentos p where p.reserva_id = p_reserva;
  if p_valor is null or p_valor < 1 or v_pago + p_valor > v_res.valor_total_centavos then
    raise exception 'O valor excede o saldo da reserva' using errcode = 'CR007';
  end if;
  insert into public.cobrancas_online (agencia_id, reserva_id, valor_centavos, provedor, id_externo, link, vence_em, criado_por)
  values (v_res.agencia_id, p_reserva, p_valor, p_provedor, p_id_externo, p_link, p_vence_em, p_usuario)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.criar_cobranca_online(uuid, uuid, integer, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.criar_cobranca_online(uuid, uuid, integer, text, text, text, timestamptz) to service_role;
