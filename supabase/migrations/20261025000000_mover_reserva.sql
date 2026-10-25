-- E9-3 (R140): move a reservation to another departure of the same tour, without overbooking.
-- Payments, companions, commission and status hang on the reservation, so they follow it.
-- The client's deal pointing at the old departure follows too (the funnel uses it to suggest stages).
create function public.mover_reserva_saida(p_reserva uuid, p_saida uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_reserva public.reservas;
  v_origem public.saidas;
  v_destino public.saidas;
  v_reservadas integer;
begin
  select r.* into v_reserva from public.reservas r where r.id = p_reserva for update;
  if not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  if v_reserva.situacao = 'cancelada' then
    raise exception 'A reserva está cancelada' using errcode = 'CR006';
  end if;
  if p_saida = v_reserva.saida_id then
    return;
  end if;

  -- Lock both departures always in the same order (by id), so two opposite moves cannot deadlock.
  perform 1 from public.saidas s where s.id in (v_reserva.saida_id, p_saida) order by s.id for update;
  select s.* into v_origem from public.saidas s where s.id = v_reserva.saida_id;
  select s.* into v_destino from public.saidas s where s.id = p_saida;
  if v_destino.id is null or v_destino.agencia_id <> v_reserva.agencia_id then
    raise exception 'Saída não encontrada' using errcode = '42501';
  end if;
  if v_destino.passeio_id <> v_origem.passeio_id then
    raise exception 'Só dá para mover para uma saída do mesmo passeio' using errcode = 'CR014';
  end if;
  if v_destino.situacao <> 'aberta' then
    raise exception 'A saída não está aberta para reservas' using errcode = 'CR002';
  end if;

  select coalesce(sum(r.qtd_pessoas), 0) into v_reservadas
  from public.reservas r where r.saida_id = p_saida and r.situacao = 'ativa';
  if v_reservadas + v_reserva.qtd_pessoas > v_destino.capacidade then
    raise exception 'Não há vagas suficientes: restam %', v_destino.capacidade - v_reservadas using errcode = 'CR001';
  end if;

  update public.reservas set saida_id = p_saida where id = p_reserva;
  update public.negociacoes set saida_id = p_saida
  where agencia_id = v_reserva.agencia_id and cliente_id = v_reserva.cliente_id and saida_id = v_origem.id;
end;
$$;

revoke all on function public.mover_reserva_saida(uuid, uuid) from public, anon;
grant execute on function public.mover_reserva_saida(uuid, uuid) to authenticated;
