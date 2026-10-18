-- Companions of a reservation. The responsible client is the first traveller; a reservation of N
-- people holds at most N-1 companions. Writes go through functions that lock the reservation, so
-- concurrent additions cannot exceed the limit.
create table public.passageiros (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  reserva_id uuid not null,
  nome text not null check (char_length(btrim(nome)) between 1 and 200),
  whatsapp text check (whatsapp ~ '^[0-9]{10,15}$'),
  cliente_id uuid,                                  -- set when registered as a client (new lead)
  criado_em timestamptz not null default now(),
  foreign key (reserva_id, agencia_id) references public.reservas (id, agencia_id),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id)
);
create index passageiros_reserva_idx on public.passageiros (reserva_id);

revoke all on public.passageiros from anon, authenticated;
grant select on public.passageiros to authenticated;
alter table public.passageiros enable row level security;
create policy passageiros_select on public.passageiros
  for select to authenticated using (private.e_membro(agencia_id));

-- CR005: every place of the reservation already has a name. CR006: reservation is cancelled.
create function public.adicionar_passageiro(
  p_reserva uuid, p_nome text, p_whatsapp text default null, p_criar_cliente boolean default false
) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare
  v_reserva public.reservas;
  v_cliente uuid;
  v_id uuid;
begin
  select r.* into v_reserva from public.reservas r where r.id = p_reserva for update;
  if not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  if v_reserva.situacao <> 'ativa' then
    raise exception 'A reserva está cancelada' using errcode = 'CR006';
  end if;
  if (select count(*) from public.passageiros p where p.reserva_id = p_reserva) >= v_reserva.qtd_pessoas - 1 then
    raise exception 'Todos os lugares desta reserva já têm nome' using errcode = 'CR005';
  end if;

  if p_criar_cliente then
    insert into public.clientes (agencia_id, nome, whatsapp)
    values (v_reserva.agencia_id, btrim(p_nome), nullif(btrim(p_whatsapp), ''))
    returning id into v_cliente;                       -- marketing consent stays "not informed"
  end if;

  insert into public.passageiros (agencia_id, reserva_id, nome, whatsapp, cliente_id)
  values (v_reserva.agencia_id, p_reserva, btrim(p_nome), nullif(btrim(p_whatsapp), ''), v_cliente)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.remover_passageiro(p_passageiro uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_passageiro public.passageiros;
begin
  select p.* into v_passageiro from public.passageiros p where p.id = p_passageiro for update;
  if not found or not private.e_membro(v_passageiro.agencia_id) then
    raise exception 'Passageiro não encontrado' using errcode = '42501';
  end if;
  delete from public.passageiros where id = p_passageiro;
end;
$$;

revoke all on function public.adicionar_passageiro(uuid, text, text, boolean), public.remover_passageiro(uuid) from public, anon;
grant execute on function public.adicionar_passageiro(uuid, text, text, boolean), public.remover_passageiro(uuid) to authenticated;

-- Deleting the account: companions, then reservations, departures and the rest (foreign key order).
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

  delete from public.passageiros where agencia_id = v_agencia;
  delete from public.reservas where agencia_id = v_agencia;
  delete from public.saidas where agencia_id = v_agencia;
  delete from public.agencias where id = v_agencia;          -- cascades to the rest and to members
  delete from auth.users where id = any (v_usuarios);
end;
$$;
