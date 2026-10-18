-- E7-1 (R76): voucher made from a fully paid reservation. The values are frozen in `dados` when it is created;
-- the client opens it by a random link until it is revoked or the reservation is cancelled.

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  reserva_id uuid not null,
  codigo text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_') check (codigo ~ '^[A-Za-z0-9_-]{24}$'),
  dados jsonb not null check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) <= 20000),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  revogado_em timestamptz,
  foreign key (reserva_id, agencia_id) references public.reservas (id, agencia_id) on delete cascade
);
create index vouchers_reserva_idx on public.vouchers (reserva_id, criado_em desc);

-- Active, fully paid reservation of the agency (paid > 0 and no balance left).
create function private.reserva_quitada(p_reserva uuid, p_agencia uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.v_reservas_saldo v
    where v.id = p_reserva and v.agencia_id = p_agencia and v.situacao = 'ativa' and v.pago_centavos > 0 and v.saldo_centavos <= 0
  )
$$;
revoke all on function private.reserva_quitada(uuid, uuid) from public;
grant execute on function private.reserva_quitada(uuid, uuid) to authenticated;

-- Members issue and mark sent/revoked; nobody can choose the code or change the frozen values.
revoke all on public.vouchers from anon, authenticated;
grant select on public.vouchers to authenticated;
grant insert (agencia_id, reserva_id, dados) on public.vouchers to authenticated;
grant update (enviado_em, revogado_em) on public.vouchers to authenticated;
alter table public.vouchers enable row level security;
create policy vouchers_select on public.vouchers for select to authenticated using (private.e_membro(agencia_id));
create policy vouchers_insert on public.vouchers for insert to authenticated
  with check (private.e_membro(agencia_id) and private.reserva_quitada(reserva_id, agencia_id));
create policy vouchers_update on public.vouchers for update to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));

-- The client's page: only the snapshot, only while not revoked and the reservation is still active.
create function public.voucher_publico(p_codigo text) returns table (dados jsonb)
  language sql stable security definer set search_path = '' as $$
  select v.dados from public.vouchers v
  join public.reservas r on r.id = v.reserva_id and r.agencia_id = v.agencia_id
  where v.codigo = p_codigo and v.revogado_em is null and r.situacao = 'ativa'
$$;
revoke all on function public.voucher_publico(text) from public;
grant execute on function public.voucher_publico(text) to anon, authenticated;
