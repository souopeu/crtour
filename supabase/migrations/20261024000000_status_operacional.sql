-- E9-1 (R136): operational status of a reservation, the day-to-day board of the operation.
-- Written only through definir_status_operacional (the table has no UPDATE grant).
create type public.status_operacional as enum ('a_definir', 'em_organizacao', 'a_comunicar', 'pronta', 'em_execucao');

alter table public.reservas
  add column status_operacional public.status_operacional not null default 'a_definir',
  add column status_operacional_em timestamptz;

-- Moving forward (even skipping steps) is free; going back needs p_voltar = true (the screen asks first).
-- A cancelled reservation keeps whatever status it had.
create function public.definir_status_operacional(p_reserva uuid, p_status public.status_operacional, p_voltar boolean default false)
  returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reserva public.reservas;
begin
  select r.* into v_reserva from public.reservas r where r.id = p_reserva for update;
  if not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  if v_reserva.situacao = 'cancelada' then
    raise exception 'A reserva está cancelada' using errcode = 'CR006';
  end if;
  if p_status is null then
    raise exception 'Status inválido' using errcode = '22023';
  end if;
  if p_status = v_reserva.status_operacional then
    return;
  end if;
  if p_status < v_reserva.status_operacional and not coalesce(p_voltar, false) then
    raise exception 'Voltar o status precisa de confirmação' using errcode = 'CR018';
  end if;
  update public.reservas set status_operacional = p_status, status_operacional_em = now() where id = p_reserva;
end;
$$;

revoke all on function public.definir_status_operacional(uuid, public.status_operacional, boolean) from public, anon;
grant execute on function public.definir_status_operacional(uuid, public.status_operacional, boolean) to authenticated;

-- The balance view also carries the status, so lists need a single query (new column at the end).
create or replace view public.v_reservas_saldo with (security_invoker = true) as
select r.id, r.agencia_id, r.saida_id, r.cliente_id, r.qtd_pessoas, r.valor_total_centavos, r.situacao, r.vencimento_saldo,
       coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0)::int as pago_centavos,
       (r.valor_total_centavos
        - coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0))::int as saldo_centavos,
       r.observacao, r.criada_em, r.status_operacional
from public.reservas r
left join public.pagamentos p on p.reserva_id = r.id
group by r.id;

-- Calendar: a departure also says how many active reservations are not ready yet ("· N a organizar").
create or replace function public.calendario_mes(p_inicio date, p_fim date)
  returns table (dia date, tipo text, id uuid, titulo text, detalhe text, valor_centavos integer, situacao text)
  language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 42 then
    raise exception 'Intervalo inválido (até 6 semanas)' using errcode = '22023';
  end if;

  return query
  select v.data, 'saida'::text, v.id, p.nome,
         v.reservadas || '/' || v.capacidade || coalesce(' · ' || nullif((
           select count(*) from public.reservas r
           where r.saida_id = v.id and r.situacao = 'ativa' and r.status_operacional not in ('pronta', 'em_execucao')
         ), 0) || ' a organizar', ''),
         null::integer,
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
