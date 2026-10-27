-- E11-5 (R164–R165): tours of several days ("excursões") with a day-by-day itinerary. The departure keeps one date,
-- the start; the end is start + days − 1. The tour type also gets 'combo' for E11-6.

create type public.tipo_passeio as enum ('individual', 'excursao', 'combo');
alter table public.passeios
  add column tipo public.tipo_passeio not null default 'individual',
  add column dias smallint not null default 1,
  add constraint passeios_dias_por_tipo check (case when tipo = 'excursao' then dias between 2 and 30 else dias = 1 end);
grant update (tipo, dias) on public.passeios to authenticated;

create table public.passeio_dias (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  passeio_id uuid not null,
  dia smallint not null check (dia between 1 and 30),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  descricao text check (char_length(descricao) <= 2000),
  unique (passeio_id, dia),
  foreign key (passeio_id, agencia_id) references public.passeios (id, agencia_id) on delete cascade
);
revoke all on public.passeio_dias from anon, authenticated;
grant select, insert, update, delete on public.passeio_dias to authenticated;
alter table public.passeio_dias enable row level security;
create policy passeio_dias_all on public.passeio_dias
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));

-- Excursions that started before this day and have not ended yet (Saídas do dia: "em andamento").
create function public.saidas_em_andamento(p_dia date) returns setof uuid
  language sql stable security invoker set search_path = '' as $$
  select s.id from public.saidas s join public.passeios p on p.id = s.passeio_id
  where p.tipo = 'excursao' and s.situacao <> 'cancelada' and s.data < p_dia and s.data + (p.dias - 1) >= p_dia
  order by s.data
$$;
revoke all on function public.saidas_em_andamento(date) from public, anon;
grant execute on function public.saidas_em_andamento(date) to authenticated;

create or replace function public.calendario_mes(p_inicio date, p_fim date)
  returns table (dia date, tipo text, id uuid, titulo text, detalhe text, valor_centavos integer, situacao text)
  language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 42 then
    raise exception 'Intervalo inválido (até 6 semanas)' using errcode = '22023';
  end if;

  -- An excursion shows on each of its days (R165): "Nome (dia 2 de 3)" after the first.
  return query
  select d::date, 'saida'::text, v.id,
         p.nome || case when d::date > v.data then ' (dia ' || (d::date - v.data + 1) || ' de ' || p.dias || ')' else '' end,
         v.reservadas || '/' || v.capacidade || coalesce(' · ' || nullif((
           select count(*) from public.reservas r
           where r.saida_id = v.id and r.situacao = 'ativa' and r.status_operacional not in ('pronta', 'em_execucao')
         ), 0) || ' a organizar', ''),
         null::integer,
         case when v.situacao = 'aberta' and v.livres <= 0 then 'lotada' else v.situacao::text end
  from public.v_saidas_vagas v
  join public.passeios p on p.id = v.passeio_id
  cross join lateral generate_series(v.data, v.data + (p.dias - 1), interval '1 day') as d
  where v.data <= p_fim and v.data + (p.dias - 1) >= p_inicio and d::date between p_inicio and p_fim;

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
