-- Month calendar (E6-2, R78–R80): departures, balances due, birthdays and (owner only) unpaid
-- costs between two dates, read-only. SECURITY INVOKER: RLS keeps every row in the caller's agency.
-- Balances: the owner sees all; a seller only the reservations she sold (same rule as "Só as minhas").
-- Costs are left out for sellers here, although RLS lets members read the raw table (see 12-spec, E4-3 note).
create function public.calendario_mes(p_inicio date, p_fim date)
  returns table (dia date, tipo text, id uuid, titulo text, detalhe text, valor_centavos integer, situacao text)
  language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 42 then
    raise exception 'Intervalo inválido (até 6 semanas)' using errcode = '22023';
  end if;

  return query
  select v.data, 'saida'::text, v.id, p.nome, v.reservadas || '/' || v.capacidade, null::integer,
         case when v.situacao = 'aberta' and v.livres <= 0 then 'lotada' else v.situacao::text end
  from public.v_saidas_vagas v
  join public.passeios p on p.id = v.passeio_id
  where v.data between p_inicio and p_fim;

  return query
  select s.vencimento_saldo, 'saldo'::text, s.id, c.nome, p.nome, s.saldo_centavos, null::text
  from public.v_reservas_saldo s
  join public.reservas r on r.id = s.id
  join public.clientes c on c.id = s.cliente_id
  join public.saidas sa on sa.id = s.saida_id
  join public.passeios p on p.id = sa.passeio_id
  where s.situacao = 'ativa' and s.saldo_centavos > 0
    and s.vencimento_saldo between p_inicio and p_fim
    and (private.e_dono(s.agencia_id) or r.vendedor_id = (select auth.uid()));

  return query
  select d::date, 'aniversario'::text, c.id, c.nome, null::text, null::integer, null::text
  from generate_series(p_inicio, p_fim, interval '1 day') as d
  join public.clientes c
    on to_char(c.aniversario, 'MM-DD') = to_char(d, 'MM-DD')
    -- 29/02 birthdays show on 28/02 in non-leap years
    or (to_char(c.aniversario, 'MM-DD') = '02-29' and to_char(d, 'MM-DD') = '02-28' and to_char(d + interval '1 day', 'MM-DD') = '03-01');

  return query
  select cs.vencimento, 'custo'::text, cs.saida_id, cs.descricao, p.nome, cs.valor_centavos, null::text
  from public.custos_saida cs
  join public.saidas sa on sa.id = cs.saida_id
  join public.passeios p on p.id = sa.passeio_id
  where cs.pago_em is null and cs.vencimento between p_inicio and p_fim
    and private.e_dono(cs.agencia_id);
end;
$$;

revoke all on function public.calendario_mes(date, date) from public, anon;
grant execute on function public.calendario_mes(date, date) to authenticated;
