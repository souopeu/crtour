-- E10-2 (R149–R150): what the agency pays out — commissions, suppliers in a batch — and the receipts of those payments.

-- Receipts of payments made (owner only). Same private bucket as the payment receipts, <agencia>/<lote>/<file>.
create table public.comprovantes_saida (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  caminho text not null unique check (char_length(caminho) <= 300),
  tipo text not null check (tipo in ('application/pdf', 'image/jpeg', 'image/png')),
  tamanho integer not null check (tamanho between 1 and 4194304),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (id, agencia_id),
  check (caminho like agencia_id::text || '/%')
);
revoke all on public.comprovantes_saida from anon, authenticated;
grant select, insert, delete on public.comprovantes_saida to authenticated;
alter table public.comprovantes_saida enable row level security;
create policy comprovantes_saida_dono on public.comprovantes_saida for all to authenticated
  using (private.e_dono(agencia_id)) with check (private.e_dono(agencia_id));

alter table public.contas_pagar add column comprovante_id uuid;
alter table public.contas_pagar add foreign key (comprovante_id, agencia_id) references public.comprovantes_saida (id, agencia_id) on delete set null (comprovante_id);
grant update (comprovante_id) on public.contas_pagar to authenticated;

-- Departure costs gain the form of payment and a receipt (older paid costs simply have none).
alter table public.custos_saida add column forma_pago public.forma_pagamento, add column comprovante_id uuid;
alter table public.custos_saida add check (pago_em is not null or forma_pago is null);
alter table public.custos_saida add foreign key (comprovante_id, agencia_id) references public.comprovantes_saida (id, agencia_id) on delete set null (comprovante_id);
grant update (forma_pago, comprovante_id) on public.custos_saida to authenticated;

-- R149: commission payments. Several per seller and month are allowed: what is due minus the sum is "a acertar".
create table public.comissoes_pagas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  vendedor_id uuid not null,
  mes date not null check (extract(day from mes) = 1),
  valor_centavos integer not null check (valor_centavos between 1 and 1000000000),
  pago_em date not null,
  forma_pago public.forma_pagamento not null,
  comprovante_id uuid,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  foreign key (vendedor_id, agencia_id) references public.membros (user_id, agencia_id) on delete cascade,
  foreign key (comprovante_id, agencia_id) references public.comprovantes_saida (id, agencia_id) on delete set null (comprovante_id)
);
create index comissoes_pagas_mes_idx on public.comissoes_pagas (agencia_id, mes);
revoke all on public.comissoes_pagas from anon, authenticated;
grant select, insert, delete on public.comissoes_pagas to authenticated;
alter table public.comissoes_pagas enable row level security;
create policy comissoes_pagas_select on public.comissoes_pagas for select to authenticated
  using (private.e_dono(agencia_id) or vendedor_id = (select auth.uid()));
create policy comissoes_pagas_insert on public.comissoes_pagas for insert to authenticated with check (private.e_dono(agencia_id));
create policy comissoes_pagas_delete on public.comissoes_pagas for delete to authenticated using (private.e_dono(agencia_id));

-- R150: pay several bills and departure costs at once (one date, form and receipt). Only what is still unpaid
-- and belongs to the caller's agency changes; returns how many were paid.
create function public.pagar_em_lote(p_contas uuid[], p_custos uuid[], p_data date, p_forma public.forma_pagamento, p_comprovante uuid)
  returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
  v_n integer;
  v_total integer := 0;
begin
  select m.agencia_id into v_agencia from public.membros m where m.user_id = (select auth.uid()) and m.papel = 'dono';
  if v_agencia is null then
    raise exception 'Só o dono paga fornecedores' using errcode = '42501';
  end if;
  if p_data is null or p_forma is null then
    raise exception 'Informe a data e a forma' using errcode = '22023';
  end if;
  if p_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data do pagamento não pode estar no futuro' using errcode = '22008';
  end if;
  update public.contas_pagar set pago_em = p_data, forma_pago = p_forma, comprovante_id = p_comprovante
  where id = any (coalesce(p_contas, '{}')) and agencia_id = v_agencia and pago_em is null;
  get diagnostics v_n = row_count;
  v_total := v_n;
  update public.custos_saida set pago_em = p_data, forma_pago = p_forma, comprovante_id = p_comprovante
  where id = any (coalesce(p_custos, '{}')) and agencia_id = v_agencia and pago_em is null;
  get diagnostics v_n = row_count;
  return v_total + v_n;   -- a receipt of another agency fails the composite keys (23503)
end;
$$;
revoke all on function public.pagar_em_lote(uuid[], uuid[], date, public.forma_pagamento, uuid) from public, anon;
grant execute on function public.pagar_em_lote(uuid[], uuid[], date, public.forma_pagamento, uuid) to authenticated;
