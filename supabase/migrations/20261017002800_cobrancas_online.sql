-- E4-6 (R57): structure for online payment (Pix/card through a provider), not integrated yet.
create type public.situacao_cobranca_online as enum ('pendente', 'paga', 'vencida', 'cancelada');

create table public.cobrancas_online (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  reserva_id uuid not null,
  valor_centavos integer not null check (valor_centavos between 1 and 1000000000),
  provedor text not null check (provedor ~ '^[a-z0-9_-]{1,40}$'),
  id_externo text not null check (char_length(id_externo) between 1 and 200),
  link text not null check (link ~ '^https://' and char_length(link) <= 2000),
  situacao public.situacao_cobranca_online not null default 'pendente',
  vence_em timestamptz,
  pagamento_id uuid references public.pagamentos (id) on delete set null,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criada_em timestamptz not null default now(),
  paga_em timestamptz,
  unique (provedor, id_externo),
  foreign key (reserva_id, agencia_id) references public.reservas (id, agencia_id) on delete cascade
);
create index cobrancas_online_reserva_idx on public.cobrancas_online (reserva_id);

revoke all on public.cobrancas_online from anon, authenticated;
grant select on public.cobrancas_online to authenticated;
alter table public.cobrancas_online enable row level security;
create policy cobrancas_online_select on public.cobrancas_online for select to authenticated using (private.e_membro(agencia_id));

-- A member asks for a charge (after the provider created it); never above the current balance.
create function public.criar_cobranca_online(p_reserva uuid, p_valor integer, p_provedor text, p_id_externo text, p_link text, p_vence_em timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_res public.reservas;
  v_pago bigint;
  v_id uuid;
begin
  select * into v_res from public.reservas where id = p_reserva;
  if not found or not private.e_membro(v_res.agencia_id) then raise exception 'Reserva não encontrada' using errcode = '42501'; end if;
  if v_res.situacao <> 'ativa' then raise exception 'A reserva está cancelada' using errcode = 'CR006'; end if;
  select coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0) into v_pago from public.pagamentos p where p.reserva_id = p_reserva;
  if p_valor is null or p_valor < 1 or v_pago + p_valor > v_res.valor_total_centavos then
    raise exception 'O valor excede o saldo da reserva' using errcode = 'CR007';
  end if;
  insert into public.cobrancas_online (agencia_id, reserva_id, valor_centavos, provedor, id_externo, link, vence_em)
  values (v_res.agencia_id, p_reserva, p_valor, p_provedor, p_id_externo, p_link, p_vence_em)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.cancelar_cobranca_online(p_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
begin
  select agencia_id into v_agencia from public.cobrancas_online where id = p_id;
  if v_agencia is null or not private.e_membro(v_agencia) then raise exception 'Cobrança não encontrada' using errcode = '42501'; end if;
  update public.cobrancas_online set situacao = 'cancelada' where id = p_id and situacao = 'pendente';
end;
$$;

-- R57: the provider's notice confirms the charge. Idempotent: a repeated notice returns the same payment.
-- Only the server may call it (service role, after validating the notice); no logged-in user can fake a payment.
create function public.confirmar_cobranca_online(p_provedor text, p_id_externo text, p_valor integer, p_forma public.forma_pagamento, p_pago_em timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cob public.cobrancas_online;
  v_res public.reservas;
  v_pago bigint;
  v_pagamento uuid;
begin
  select * into v_cob from public.cobrancas_online where provedor = p_provedor and id_externo = p_id_externo for update;
  if not found then raise exception 'Cobrança não encontrada' using errcode = 'P0002'; end if;
  if v_cob.situacao = 'paga' then return v_cob.pagamento_id; end if;
  if v_cob.situacao = 'cancelada' then raise exception 'Cobrança cancelada: confira manualmente' using errcode = 'CR015'; end if;

  select * into v_res from public.reservas where id = v_cob.reserva_id for update; -- same lock as registrar_pagamento
  if v_res.situacao <> 'ativa' then raise exception 'A reserva está cancelada' using errcode = 'CR006'; end if;
  select coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0) into v_pago from public.pagamentos p where p.reserva_id = v_res.id;
  if p_valor is null or p_valor < 1 or v_pago + p_valor > v_res.valor_total_centavos then
    raise exception 'O valor excede o saldo da reserva' using errcode = 'CR007';
  end if;

  insert into public.pagamentos (agencia_id, reserva_id, tipo, forma, valor_centavos, data, observacao)
  values (v_res.agencia_id, v_res.id,
    (case when v_pago + p_valor >= v_res.valor_total_centavos then 'saldo' else 'sinal' end)::public.tipo_pagamento,
    p_forma, p_valor, (p_pago_em at time zone 'America/Sao_Paulo')::date, left(format('Pago online (%s %s)', p_provedor, p_id_externo), 500))
  returning id into v_pagamento;
  update public.cobrancas_online set situacao = 'paga', pagamento_id = v_pagamento, paga_em = p_pago_em where id = v_cob.id;
  return v_pagamento;
end;
$$;

revoke all on function public.criar_cobranca_online(uuid, integer, text, text, text, timestamptz), public.cancelar_cobranca_online(uuid),
  public.confirmar_cobranca_online(text, text, integer, public.forma_pagamento, timestamptz) from public, anon, authenticated;
grant execute on function public.criar_cobranca_online(uuid, integer, text, text, text, timestamptz), public.cancelar_cobranca_online(uuid) to authenticated;
grant execute on function public.confirmar_cobranca_online(text, text, integer, public.forma_pagamento, timestamptz) to service_role;
