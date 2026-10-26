-- E10-1 (R145–R148): bills of the agency that are not a departure cost (rent, staff, ads, software…).
-- Only the owner sees and writes them (R144). Instalments and monthly series share grupo_id; parcela is
-- the instalment number (or the month number in a series), so the clock can never create the same month twice.
create type public.categoria_conta as enum ('aluguel', 'pessoal', 'marketing', 'sistemas', 'impostos', 'transporte', 'outros');

create table public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  categoria public.categoria_conta not null default 'outros',
  valor_centavos integer not null check (valor_centavos between 1 and 1000000000),
  vencimento date not null,
  fornecedor_id uuid,
  observacao text check (char_length(observacao) <= 1000),
  grupo_id uuid,
  parcela smallint check (parcela between 1 and 600),
  total_parcelas smallint check (total_parcelas between 2 and 60),
  recorrente boolean not null default false,
  dia_base smallint check (dia_base between 1 and 31), -- the day the series was created for (31 → last day)
  pago_em date,
  forma_pago public.forma_pagamento,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (id, agencia_id),
  foreign key (fornecedor_id, agencia_id) references public.fornecedores (id, agencia_id) on delete set null (fornecedor_id),
  check ((pago_em is null) = (forma_pago is null)),
  check ((grupo_id is null) = (parcela is null)),
  check (not (recorrente and total_parcelas is not null))
);
create unique index contas_pagar_grupo_parcela_idx on public.contas_pagar (grupo_id, parcela) where grupo_id is not null;
create index contas_pagar_agencia_venc_idx on public.contas_pagar (agencia_id, vencimento);

revoke all on public.contas_pagar from anon, authenticated;
grant select, delete on public.contas_pagar to authenticated;
grant update (descricao, categoria, valor_centavos, vencimento, fornecedor_id, observacao, pago_em, forma_pago) on public.contas_pagar to authenticated;
alter table public.contas_pagar enable row level security;
create policy contas_pagar_dono on public.contas_pagar for all to authenticated
  using (private.e_dono(agencia_id)) with check (private.e_dono(agencia_id));

-- The k-th month after `base`, on `dia` (or the last day when the month is shorter).
create function private.mes_mais(base date, k integer, dia integer) returns date
  language sql immutable set search_path = '' as $$
  select (date_trunc('month', base) + make_interval(months => k))::date
         + (least(dia, extract(day from (date_trunc('month', base) + make_interval(months => k + 1) - interval '1 day'))::int) - 1);
$$;

-- R145–R147: one bill, N instalments (cents left over go to the first) or the first month of a series.
create function public.criar_conta_pagar(
  p_descricao text, p_categoria public.categoria_conta, p_valor integer, p_vencimento date,
  p_fornecedor uuid, p_observacao text, p_parcelas integer default 1, p_recorrente boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
  v_grupo uuid;
  v_dia integer := extract(day from p_vencimento);
  v_base integer;
  v_primeira uuid;
  v_id uuid;
begin
  select m.agencia_id into v_agencia from public.membros m where m.user_id = (select auth.uid()) and m.papel = 'dono';
  if v_agencia is null then
    raise exception 'Só o dono lança contas a pagar' using errcode = '42501';
  end if;
  if p_vencimento is null or p_valor is null or p_valor < 1 or p_parcelas is null or p_parcelas not between 1 and 60
     or (p_parcelas > 1 and coalesce(p_recorrente, false)) or p_valor < p_parcelas then
    raise exception 'Dados da conta inválidos' using errcode = '22023';
  end if;
  if p_parcelas > 1 or p_recorrente then
    v_grupo := gen_random_uuid();
  end if;
  v_base := p_valor / p_parcelas;
  for i in 1..p_parcelas loop
    insert into public.contas_pagar (agencia_id, descricao, categoria, valor_centavos, vencimento, fornecedor_id, observacao,
                                     grupo_id, parcela, total_parcelas, recorrente, dia_base)
    values (v_agencia, btrim(p_descricao), p_categoria,
            v_base + case when i = 1 then p_valor - v_base * p_parcelas else 0 end,
            private.mes_mais(p_vencimento, i - 1, v_dia), p_fornecedor, nullif(btrim(p_observacao), ''),
            v_grupo, case when v_grupo is null then null else i end,
            case when p_parcelas > 1 then p_parcelas end, coalesce(p_recorrente, false), case when v_grupo is null then null else v_dia end)
    returning id into v_id;   -- a supplier of another agency fails the composite key (23503)
    if i = 1 then v_primeira := v_id; end if;
  end loop;
  return v_primeira;
end;
$$;

-- Delete one bill, or this and the next instalments of its group.
create function public.excluir_conta_pagar(p_conta uuid, p_seguintes boolean default false) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_conta public.contas_pagar;
begin
  select c.* into v_conta from public.contas_pagar c where c.id = p_conta;
  if not found or not private.e_dono(v_conta.agencia_id) then
    raise exception 'Conta não encontrada' using errcode = '42501';
  end if;
  if coalesce(p_seguintes, false) and v_conta.grupo_id is not null then
    delete from public.contas_pagar where grupo_id = v_conta.grupo_id and parcela >= v_conta.parcela;
  else
    delete from public.contas_pagar where id = p_conta;
  end if;
end;
$$;

create function public.parar_recorrencia(p_grupo uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.contas_pagar c where c.grupo_id = p_grupo and private.e_dono(c.agencia_id)) then
    raise exception 'Série não encontrada' using errcode = '42501';
  end if;
  update public.contas_pagar set recorrente = false where grupo_id = p_grupo;
end;
$$;

-- R147: for the clock (service key only). A series gets its next month once the last one is due within 30 days;
-- a clock that was down catches up month by month (at most 24). Running again creates nothing.
create function public.gerar_recorrencias(p_hoje date default (now() at time zone 'America/Sao_Paulo')::date) returns integer
  language plpgsql security definer set search_path = '' as $$
declare
  v_ultima public.contas_pagar;
  v_criadas integer := 0;
  v_n integer;
begin
  for v_ultima in
    select distinct on (c.grupo_id) c.* from public.contas_pagar c
    where c.recorrente order by c.grupo_id, c.parcela desc
  loop
    for k in 1..24 loop
      exit when v_ultima.vencimento - 30 > p_hoje;
      insert into public.contas_pagar (agencia_id, descricao, categoria, valor_centavos, vencimento, fornecedor_id, observacao,
                                       grupo_id, parcela, recorrente, dia_base, criado_por)
      values (v_ultima.agencia_id, v_ultima.descricao, v_ultima.categoria, v_ultima.valor_centavos,
              private.mes_mais(v_ultima.vencimento, 1, v_ultima.dia_base), v_ultima.fornecedor_id, v_ultima.observacao,
              v_ultima.grupo_id, v_ultima.parcela + 1, true, v_ultima.dia_base, null)
      on conflict (grupo_id, parcela) where grupo_id is not null do nothing
      returning * into v_ultima;
      get diagnostics v_n = row_count;
      exit when v_n = 0;
      v_criadas := v_criadas + 1;
    end loop;
  end loop;
  return v_criadas;
end;
$$;

revoke all on function private.mes_mais(date, integer, integer) from public, anon, authenticated;
revoke all on function public.criar_conta_pagar(text, public.categoria_conta, integer, date, uuid, text, integer, boolean),
  public.excluir_conta_pagar(uuid, boolean), public.parar_recorrencia(uuid) from public, anon;
grant execute on function public.criar_conta_pagar(text, public.categoria_conta, integer, date, uuid, text, integer, boolean),
  public.excluir_conta_pagar(uuid, boolean), public.parar_recorrencia(uuid) to authenticated;
revoke all on function public.gerar_recorrencias(date) from public, anon, authenticated;
grant execute on function public.gerar_recorrencias(date) to service_role;
