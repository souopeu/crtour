-- E11-2 (R157–R159): extras (subprodutos) sold with a reservation: lunch, photos, a kit…
-- The reservation keeps name, price and cost of the moment (reserva_itens), so a later change to the extra never
-- touches it. `reservas.valor_total_centavos` stays the full total; `valor_extras_centavos` is the extras part,
-- left out of the commission. The cost is readable by members, like custos_saida; the screens show it to the owner.
-- New errors: CR023 extra not available for this tour, CR024 total below the extras.

create type public.cobranca_extra as enum ('por_pessoa', 'por_reserva');

create table public.extras (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  preco_centavos integer not null check (preco_centavos between 0 and 1000000000),
  custo_centavos integer check (custo_centavos between 0 and 1000000000),
  cobranca public.cobranca_extra not null default 'por_pessoa', -- only the suggested quantity: per person or 1
  todos_passeios boolean not null default true,                 -- false = only the tours in extras_passeios
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (id, agencia_id)
);
create index extras_agencia_idx on public.extras (agencia_id, ativo, lower(nome));

create table public.extras_passeios (
  extra_id uuid not null,
  passeio_id uuid not null,
  agencia_id uuid not null,
  primary key (extra_id, passeio_id),
  foreign key (extra_id, agencia_id) references public.extras (id, agencia_id) on delete cascade,
  foreign key (passeio_id, agencia_id) references public.passeios (id, agencia_id) on delete cascade
);

alter table public.reservas add column valor_extras_centavos integer not null default 0 check (valor_extras_centavos >= 0); -- only through functions

create table public.reserva_itens (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  reserva_id uuid not null,
  extra_id uuid references public.extras (id) on delete set null, -- the item keeps its name and values
  nome text not null,
  preco_centavos integer not null check (preco_centavos between 0 and 1000000000),
  custo_centavos integer check (custo_centavos between 0 and 1000000000),
  quantidade integer not null check (quantidade between 1 and 500),
  criado_em timestamptz not null default now(),
  foreign key (reserva_id, agencia_id) references public.reservas (id, agencia_id) on delete cascade
);
create index reserva_itens_reserva_idx on public.reserva_itens (reserva_id);

revoke all on public.extras, public.extras_passeios, public.reserva_itens from anon, authenticated;
grant select, insert, update, delete on public.extras, public.extras_passeios to authenticated;
grant select on public.reserva_itens to authenticated;
alter table public.extras enable row level security;
alter table public.extras_passeios enable row level security;
alter table public.reserva_itens enable row level security;
create policy extras_all on public.extras
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy extras_passeios_all on public.extras_passeios
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy reserva_itens_select on public.reserva_itens
  for select to authenticated using (private.e_membro(agencia_id));

-- Adds one item to a reservation already locked by the caller; returns its value. Does not touch the totals.
create function private.inserir_item(p_reserva public.reservas, p_extra uuid, p_qtd integer) returns bigint
  language plpgsql security definer set search_path = '' as $$
declare
  v_extra public.extras;
begin
  select e.* into v_extra from public.extras e
  where e.id = p_extra and e.agencia_id = p_reserva.agencia_id and e.ativo
    and (e.todos_passeios or exists (
      select 1 from public.extras_passeios ep join public.saidas s on s.passeio_id = ep.passeio_id
      where ep.extra_id = e.id and s.id = p_reserva.saida_id));
  if not found then
    raise exception 'Este extra não está disponível para este passeio' using errcode = 'CR023';
  end if;
  if p_qtd is null or p_qtd < 1 or p_qtd > 500 then
    raise exception 'Quantidade do extra inválida' using errcode = '23514';
  end if;
  insert into public.reserva_itens (agencia_id, reserva_id, extra_id, nome, preco_centavos, custo_centavos, quantidade)
  values (p_reserva.agencia_id, p_reserva.id, v_extra.id, v_extra.nome, v_extra.preco_centavos, v_extra.custo_centavos, p_qtd);
  return v_extra.preco_centavos::bigint * p_qtd;
end;
$$;
revoke all on function private.inserir_item(public.reservas, uuid, integer) from public, anon, authenticated;

create function private.somar_extras(p_reserva uuid, p_delta bigint) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if (select valor_total_centavos + p_delta from public.reservas where id = p_reserva) > 1000000000 then
    raise exception 'Valor total fora do limite' using errcode = '22003';
  end if;
  update public.reservas
  set valor_total_centavos = valor_total_centavos + p_delta, valor_extras_centavos = valor_extras_centavos + p_delta
  where id = p_reserva;
end;
$$;
revoke all on function private.somar_extras(uuid, bigint) from public, anon, authenticated;

-- criar_reserva gains the extras: [{"extra": uuid, "quantidade": n}]. Same lock and checks as before;
-- calls with five arguments (import, one-off service) keep working.
drop function public.criar_reserva(uuid, uuid, integer, integer, text);
create function public.criar_reserva(
  p_saida uuid, p_cliente uuid, p_qtd integer, p_valor_total integer default null, p_observacao text default null,
  p_itens jsonb default null
) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare
  v_saida public.saidas;
  v_reservadas integer;
  v_total bigint;
  v_id uuid;
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

  select coalesce(sum(r.qtd_pessoas), 0) into v_reservadas
  from public.reservas r where r.saida_id = p_saida and r.situacao = 'ativa';
  if v_reservadas + p_qtd > v_saida.capacidade then
    raise exception 'Não há vagas suficientes: restam %', v_saida.capacidade - v_reservadas using errcode = 'CR001';
  end if;

  v_total := coalesce(p_valor_total, p_qtd::bigint * v_saida.preco_centavos);
  if v_total < 0 or v_total > 1000000000 then
    raise exception 'Valor total fora do limite' using errcode = '22003';
  end if;

  insert into public.reservas (agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, observacao)
  values (v_saida.agencia_id, p_saida, p_cliente, p_qtd, v_total::int, nullif(btrim(p_observacao), ''))
  returning * into v_reserva;  -- the composite foreign key refuses a client of another agency (23503)
  v_id := v_reserva.id;

  if jsonb_typeof(p_itens) = 'array' then
    for v_item in select * from jsonb_array_elements(p_itens) loop
      v_extras := v_extras + private.inserir_item(v_reserva, (v_item->>'extra')::uuid, (v_item->>'quantidade')::int);
    end loop;
    perform private.somar_extras(v_id, v_extras);
  end if;
  return v_id;
end;
$$;

create function public.adicionar_item_reserva(p_reserva uuid, p_extra uuid, p_qtd integer) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_reserva public.reservas;
begin
  select r.* into v_reserva from public.reservas r where r.id = p_reserva for update;
  if not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  if v_reserva.situacao <> 'ativa' then
    raise exception 'A reserva está cancelada' using errcode = 'CR006';
  end if;
  perform private.somar_extras(p_reserva, private.inserir_item(v_reserva, p_extra, p_qtd));
end;
$$;

create function public.remover_item_reserva(p_item uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_item public.reserva_itens;
  v_reserva public.reservas;
  v_pago bigint;
begin
  select i.* into v_item from public.reserva_itens i where i.id = p_item;
  select r.* into v_reserva from public.reservas r where r.id = v_item.reserva_id for update;
  if v_item.id is null or not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Extra não encontrado' using errcode = '42501';
  end if;
  if v_reserva.situacao <> 'ativa' then
    raise exception 'A reserva está cancelada' using errcode = 'CR006';
  end if;
  select coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0) into v_pago
  from public.pagamentos p where p.reserva_id = v_reserva.id;
  if v_reserva.valor_total_centavos - v_item.preco_centavos::bigint * v_item.quantidade < v_pago then
    raise exception 'O total não pode ficar abaixo do que já foi pago' using errcode = 'CR007';
  end if;
  delete from public.reserva_itens where id = p_item;
  perform private.somar_extras(v_reserva.id, -(v_item.preco_centavos::bigint * v_item.quantidade));
end;
$$;

-- The edited total always includes the extras: it can never go below them.
create or replace function public.alterar_valor_total(p_reserva uuid, p_valor integer) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_reserva public.reservas;
  v_pago bigint;
begin
  select r.* into v_reserva from public.reservas r where r.id = p_reserva for update;
  if not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  if v_reserva.situacao <> 'ativa' then
    raise exception 'A reserva está cancelada' using errcode = 'CR006';
  end if;
  if p_valor is null or p_valor < 0 or p_valor > 1000000000 then
    raise exception 'Valor inválido' using errcode = '22003';
  end if;
  if p_valor < v_reserva.valor_extras_centavos then
    raise exception 'O total não pode ficar abaixo do valor dos extras' using errcode = 'CR024';
  end if;
  select coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0) into v_pago
  from public.pagamentos p where p.reserva_id = p_reserva;
  if p_valor < v_pago then
    raise exception 'O total não pode ficar abaixo do que já foi pago' using errcode = 'CR007';
  end if;
  update public.reservas set valor_total_centavos = p_valor where id = p_reserva;
end;
$$;

-- R159: percentage commissions are on the tour only (total minus extras); "quitada" still needs the full total.
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
    where r.situacao = 'ativa' and r.valor_total_centavos > 0
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

revoke all on function public.criar_reserva(uuid, uuid, integer, integer, text, jsonb),
  public.adicionar_item_reserva(uuid, uuid, integer), public.remover_item_reserva(uuid) from public, anon;
grant execute on function public.criar_reserva(uuid, uuid, integer, integer, text, jsonb),
  public.adicionar_item_reserva(uuid, uuid, integer), public.remover_item_reserva(uuid) to authenticated;
