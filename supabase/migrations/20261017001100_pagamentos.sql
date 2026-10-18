-- Payments (down payment, instalments, balance) and refunds. Records are never edited or deleted:
-- a refund is a new record that points to the original. All writes go through functions that lock
-- the reservation, so simultaneous payments can never exceed the total.
create type public.tipo_pagamento as enum ('sinal', 'parcela', 'saldo', 'estorno');
create type public.forma_pagamento as enum ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro');

alter table public.reservas add column vencimento_saldo date;   -- changed only through a function

create function private.hoje() returns date
  language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  reserva_id uuid not null,
  tipo public.tipo_pagamento not null,
  forma public.forma_pagamento not null default 'outro',
  valor_centavos integer not null check (valor_centavos between 1 and 1000000000),
  data date not null,
  observacao text check (char_length(observacao) <= 500),
  estorno_de uuid,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (id, agencia_id),
  unique (estorno_de),                                   -- a payment is refunded at most once
  foreign key (reserva_id, agencia_id) references public.reservas (id, agencia_id),
  foreign key (estorno_de, agencia_id) references public.pagamentos (id, agencia_id),
  check ((tipo = 'estorno') = (estorno_de is not null))
);
create index pagamentos_reserva_idx on public.pagamentos (reserva_id);

revoke all on public.pagamentos from anon, authenticated;
grant select on public.pagamentos to authenticated;
alter table public.pagamentos enable row level security;
create policy pagamentos_select on public.pagamentos
  for select to authenticated using (private.e_membro(agencia_id));

-- Paid (net of refunds) and balance per reservation.
create view public.v_reservas_saldo with (security_invoker = true) as
select r.id, r.agencia_id, r.saida_id, r.cliente_id, r.qtd_pessoas, r.valor_total_centavos, r.situacao, r.vencimento_saldo,
       coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0)::int as pago_centavos,
       (r.valor_total_centavos
        - coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0))::int as saldo_centavos
from public.reservas r
left join public.pagamentos p on p.reserva_id = r.id
group by r.id;
revoke all on public.v_reservas_saldo from anon, authenticated;
grant select on public.v_reservas_saldo to authenticated;

-- CR007: amount exceeds the balance / total below what was paid. CR008: already refunded.
create function public.registrar_pagamento(
  p_reserva uuid, p_valor integer, p_tipo public.tipo_pagamento, p_forma public.forma_pagamento,
  p_data date, p_observacao text default null
) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare
  v_reserva public.reservas;
  v_pago bigint;
  v_id uuid;
begin
  select r.* into v_reserva from public.reservas r where r.id = p_reserva for update;
  if not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  if p_tipo = 'estorno' then
    raise exception 'Use a função de estorno' using errcode = '22023';
  end if;
  if v_reserva.situacao <> 'ativa' then
    raise exception 'A reserva está cancelada' using errcode = 'CR006';
  end if;
  if p_valor is null or p_valor < 1 or p_valor > 1000000000 then
    raise exception 'Valor inválido' using errcode = '23514';
  end if;
  if p_data is null or p_data > private.hoje() then
    raise exception 'A data do pagamento não pode estar no futuro' using errcode = '22008';
  end if;

  select coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0) into v_pago
  from public.pagamentos p where p.reserva_id = p_reserva;
  if v_pago + p_valor > v_reserva.valor_total_centavos then
    raise exception 'O valor excede o saldo da reserva' using errcode = 'CR007';
  end if;

  insert into public.pagamentos (agencia_id, reserva_id, tipo, forma, valor_centavos, data, observacao)
  values (v_reserva.agencia_id, p_reserva, p_tipo, p_forma, p_valor, p_data, nullif(btrim(p_observacao), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.estornar_pagamento(p_pagamento uuid, p_data date default null, p_observacao text default null)
  returns uuid
  language plpgsql security definer set search_path = '' as $$
declare
  v_pag public.pagamentos;
  v_reserva public.reservas;
  v_id uuid;
begin
  select p.* into v_pag from public.pagamentos p where p.id = p_pagamento;
  if not found then
    raise exception 'Pagamento não encontrado' using errcode = '42501';
  end if;
  select r.* into v_reserva from public.reservas r where r.id = v_pag.reserva_id for update;   -- same lock as payments
  if not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Pagamento não encontrado' using errcode = '42501';
  end if;
  if v_pag.tipo = 'estorno' then
    raise exception 'Um estorno não pode ser estornado' using errcode = '22023';
  end if;
  if exists (select 1 from public.pagamentos e where e.estorno_de = p_pagamento) then
    raise exception 'Este pagamento já foi estornado' using errcode = 'CR008';
  end if;

  insert into public.pagamentos (agencia_id, reserva_id, tipo, forma, valor_centavos, data, observacao, estorno_de)
  values (v_pag.agencia_id, v_pag.reserva_id, 'estorno', v_pag.forma, v_pag.valor_centavos,
          coalesce(p_data, private.hoje()), nullif(btrim(p_observacao), ''), p_pagamento)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.definir_vencimento_saldo(p_reserva uuid, p_data date) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_reserva public.reservas;
begin
  select r.* into v_reserva from public.reservas r where r.id = p_reserva for update;
  if not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  update public.reservas set vencimento_saldo = p_data where id = p_reserva;
end;
$$;

create function public.alterar_valor_total(p_reserva uuid, p_valor integer) returns void
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
  select coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0) into v_pago
  from public.pagamentos p where p.reserva_id = p_reserva;
  if p_valor < v_pago then
    raise exception 'O total não pode ficar abaixo do que já foi pago' using errcode = 'CR007';
  end if;
  update public.reservas set valor_total_centavos = p_valor where id = p_reserva;
end;
$$;

revoke all on function public.registrar_pagamento(uuid, integer, public.tipo_pagamento, public.forma_pagamento, date, text),
  public.estornar_pagamento(uuid, date, text), public.definir_vencimento_saldo(uuid, date), public.alterar_valor_total(uuid, integer)
  from public, anon;
grant execute on function public.registrar_pagamento(uuid, integer, public.tipo_pagamento, public.forma_pagamento, date, text),
  public.estornar_pagamento(uuid, date, text), public.definir_vencimento_saldo(uuid, date), public.alterar_valor_total(uuid, integer)
  to authenticated;

-- Deleting the account: payments, companions, reservations, departures, then the rest.
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

  delete from public.pagamentos where agencia_id = v_agencia;
  delete from public.passageiros where agencia_id = v_agencia;
  delete from public.reservas where agencia_id = v_agencia;
  delete from public.saidas where agencia_id = v_agencia;
  delete from public.agencias where id = v_agencia;          -- cascades to the rest and to members
  delete from auth.users where id = any (v_usuarios);
end;
$$;
