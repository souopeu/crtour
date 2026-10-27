-- E11-4 (R162–R163): B2B rate, for selling to partner agencies. Only the owner sees and uses it: the B2B price lives in
-- its own table readable by the owner only (a seller cannot read it even straight from the API). The partner is a
-- client marked `parceiro`. A B2B reservation earns no seller commission.
-- New errors: CR027 departure without B2B price, CR028 B2B for a client that is not a partner.

create table public.saidas_b2b (
  saida_id uuid primary key,
  agencia_id uuid not null,
  preco_centavos integer not null check (preco_centavos between 0 and 1000000000),
  foreign key (saida_id, agencia_id) references public.saidas (id, agencia_id) on delete cascade
);
revoke all on public.saidas_b2b from anon, authenticated;
grant select, insert, update, delete on public.saidas_b2b to authenticated;
alter table public.saidas_b2b enable row level security;
create policy saidas_b2b_dono on public.saidas_b2b
  for all to authenticated using (private.e_dono(agencia_id)) with check (private.e_dono(agencia_id));

alter table public.clientes add column parceiro boolean not null default false;
grant update (parceiro) on public.clientes to authenticated;

create type public.tarifa_reserva as enum ('balcao', 'b2b');
alter table public.reservas add column tarifa public.tarifa_reserva not null default 'balcao'; -- set only by criar_reserva

-- criar_reserva gains the rate. Same lock and checks; calls without it stay at the counter price.
drop function public.criar_reserva(uuid, uuid, integer, integer, text, jsonb);
create function public.criar_reserva(
  p_saida uuid, p_cliente uuid, p_qtd integer, p_valor_total integer default null, p_observacao text default null,
  p_itens jsonb default null, p_tarifa public.tarifa_reserva default 'balcao'
) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare
  v_saida public.saidas;
  v_reservadas integer;
  v_preco integer;
  v_total bigint;
  v_reserva public.reservas;
  v_extras bigint := 0;
  v_item jsonb;
begin
  -- The row lock serializes every reservation of this departure.
  select s.* into v_saida from public.saidas s where s.id = p_saida for update;
  if not found or not private.e_membro(v_saida.agencia_id) then
    raise exception 'Saída não encontrada' using errcode = '42501';
  end if;
  if v_saida.situacao <> 'aberta' then
    raise exception 'A saída não está aberta para reservas' using errcode = 'CR002';
  end if;
  if p_qtd is null or p_qtd < 1 or p_qtd > 500 then
    raise exception 'Quantidade de pessoas inválida' using errcode = '23514';
  end if;

  v_preco := v_saida.preco_centavos;
  if p_tarifa = 'b2b' then
    if not private.e_dono(v_saida.agencia_id) then
      raise exception 'Só o dono vende com tarifa B2B' using errcode = '42501';
    end if;
    select b.preco_centavos into v_preco from public.saidas_b2b b where b.saida_id = p_saida;
    if not found then
      raise exception 'Esta saída não tem preço B2B' using errcode = 'CR027';
    end if;
    if not exists (select 1 from public.clientes c where c.id = p_cliente and c.agencia_id = v_saida.agencia_id and c.parceiro) then
      raise exception 'A tarifa B2B é só para cliente parceiro' using errcode = 'CR028';
    end if;
  end if;

  select coalesce(sum(r.qtd_pessoas), 0) into v_reservadas
  from public.reservas r where r.saida_id = p_saida and r.situacao = 'ativa';
  if v_reservadas + p_qtd > v_saida.capacidade then
    raise exception 'Não há vagas suficientes: restam %', v_saida.capacidade - v_reservadas using errcode = 'CR001';
  end if;

  v_total := coalesce(p_valor_total, p_qtd::bigint * v_preco);
  if v_total < 0 or v_total > 1000000000 then
    raise exception 'Valor total fora do limite' using errcode = '22003';
  end if;

  insert into public.reservas (agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, observacao, tarifa)
  values (v_saida.agencia_id, p_saida, p_cliente, p_qtd, v_total::int, nullif(btrim(p_observacao), ''), coalesce(p_tarifa, 'balcao'))
  returning * into v_reserva;  -- the composite foreign key refuses a client of another agency (23503)

  if jsonb_typeof(p_itens) = 'array' then
    for v_item in select * from jsonb_array_elements(p_itens) loop
      v_extras := v_extras + private.inserir_item(v_reserva, (v_item->>'extra')::uuid, (v_item->>'quantidade')::int);
    end loop;
    perform private.somar_extras(v_reserva.id, v_extras);
  end if;
  return v_reserva.id;
end;
$$;
revoke all on function public.criar_reserva(uuid, uuid, integer, integer, text, jsonb, public.tarifa_reserva) from public, anon;
grant execute on function public.criar_reserva(uuid, uuid, integer, integer, text, jsonb, public.tarifa_reserva) to authenticated;

-- The batch of departures gains the B2B price (owner only).
drop function public.criar_saidas_lote(uuid, date[], time[], integer, integer, uuid);
create function public.criar_saidas_lote(
  p_passeio uuid, p_datas date[], p_horarios time[], p_capacidade integer, p_preco integer, p_veiculo uuid default null,
  p_preco_b2b integer default null
) returns table (criadas integer, puladas integer)
  language plpgsql security definer set search_path = '' as $$
declare
  v_passeio public.passeios;
  v_total integer := coalesce(cardinality(p_datas), 0) * greatest(coalesce(cardinality(p_horarios), 0), 1);
begin
  -- Locks the tour so two batches at the same time cannot both create the same date and time.
  select p.* into v_passeio from public.passeios p where p.id = p_passeio for update;
  if not found or not private.e_membro(v_passeio.agencia_id) then
    raise exception 'Passeio não encontrado' using errcode = '42501';
  end if;
  if p_preco_b2b is not null and not private.e_dono(v_passeio.agencia_id) then
    raise exception 'Só o dono define o preço B2B' using errcode = '42501';
  end if;
  if v_passeio.arquivado or v_passeio.sob_medida then
    raise exception 'Este passeio não recebe saídas em lote' using errcode = 'CR022';
  end if;
  if v_total < 1 or v_total > 500 then
    raise exception 'Escolha de 1 a 500 saídas por vez' using errcode = '22023';
  end if;

  -- capacity, price and vehicle are checked by the table (checks, CR019 trigger, composite foreign key)
  with novas as (
    insert into public.saidas (agencia_id, passeio_id, data, horario, capacidade, preco_centavos, veiculo_id)
    select v_passeio.agencia_id, p_passeio, d, h, p_capacidade, p_preco, p_veiculo
    from (select distinct unnest(p_datas) as d) datas
    cross join (select distinct unnest(coalesce(nullif(p_horarios, '{}'), array[null::time])) as h) horarios
    where not exists (
      select 1 from public.saidas s where s.passeio_id = p_passeio and s.data = datas.d and s.horario is not distinct from horarios.h
    )
    returning id
  ), b2b as (
    insert into public.saidas_b2b (saida_id, agencia_id, preco_centavos)
    select id, v_passeio.agencia_id, p_preco_b2b from novas where p_preco_b2b is not null
  )
  select count(*)::int into criadas from novas;
  puladas := (select count(*) from (select distinct unnest(p_datas)) a)
           * (select count(*) from (select distinct unnest(coalesce(nullif(p_horarios, '{}'), array[null::time]))) b) - criadas;
  return next;
end;
$$;
revoke all on function public.criar_saidas_lote(uuid, date[], time[], integer, integer, uuid, integer) from public, anon;
grant execute on function public.criar_saidas_lote(uuid, date[], time[], integer, integer, uuid, integer) to authenticated;

-- The balance view also carries the rate (new column at the end), for the filters of Reservas and Cobranças.
create or replace view public.v_reservas_saldo with (security_invoker = true) as
select r.id, r.agencia_id, r.saida_id, r.cliente_id, r.qtd_pessoas, r.valor_total_centavos, r.situacao, r.vencimento_saldo,
       coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0)::int as pago_centavos,
       (r.valor_total_centavos
        - coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0))::int as saldo_centavos,
       r.observacao, r.criada_em, r.status_operacional, r.tarifa
from public.reservas r
left join public.pagamentos p on p.reserva_id = r.id
group by r.id;

-- R163: B2B reservations earn no seller commission.
create or replace function public.comissoes_do_mes(p_mes date)
returns table (reserva_id uuid, vendedor_id uuid, cliente_id uuid, saida_id uuid, qtd_pessoas integer, valor_total_centavos integer, quitada_em date, comissao_centavos integer)
  language sql stable security invoker set search_path = '' as $$
  with mov as (
    select p.reserva_id, p.data, p.criado_em,
      case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end as v,
      sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end)
        over (partition by p.reserva_id order by p.data, p.criado_em, p.id rows unbounded preceding) as acum
    from public.pagamentos p
  ), quit as (
    select r.id,
      max(m.data) filter (where m.acum >= r.valor_total_centavos and m.acum - m.v < r.valor_total_centavos) as quitada_em,
      sum(m.v) as pago
    from public.reservas r join mov m on m.reserva_id = r.id
    where r.situacao = 'ativa' and r.valor_total_centavos > 0 and r.tarifa = 'balcao'
    group by r.id
  )
  select r.id, r.vendedor_id, r.cliente_id, r.saida_id, r.qtd_pessoas, r.valor_total_centavos, q.quitada_em,
    (case a.regra_comissao
      when 'percentual_vendedor' then round((r.valor_total_centavos - r.valor_extras_centavos) * coalesce(m.comissao_percentual, 0) / 100)
      when 'percentual_passeio' then round((r.valor_total_centavos - r.valor_extras_centavos) * ps.comissao_percentual / 100)
      else r.qtd_pessoas::numeric * ps.comissao_por_pessoa_centavos end)::int
  from quit q
  join public.reservas r on r.id = q.id
  join public.agencias a on a.id = r.agencia_id and a.regra_comissao is not null
  join public.saidas s on s.id = r.saida_id
  join public.passeios ps on ps.id = s.passeio_id
  left join public.membros m on m.user_id = r.vendedor_id and m.agencia_id = r.agencia_id
  where q.pago >= r.valor_total_centavos
    and q.quitada_em >= p_mes and q.quitada_em < (p_mes + interval '1 month')::date
    and (private.e_dono(r.agencia_id) or r.vendedor_id = (select auth.uid()))
  order by q.quitada_em, r.id
$$;
