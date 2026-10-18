-- Reservations with a database-enforced seat lock. The app can never insert into `reservas`
-- directly: only the functions below, which lock the departure row first, so two sellers
-- reserving at the same time cannot exceed the capacity.
create type public.situacao_reserva as enum ('ativa', 'cancelada');

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  saida_id uuid not null,
  cliente_id uuid not null,                       -- the responsible client
  qtd_pessoas integer not null check (qtd_pessoas between 1 and 500),
  valor_total_centavos integer not null check (valor_total_centavos between 0 and 1000000000),
  situacao public.situacao_reserva not null default 'ativa',
  observacao text check (char_length(observacao) <= 1000),
  criada_por uuid default auth.uid() references auth.users (id) on delete set null,
  criada_em timestamptz not null default now(),
  cancelada_em timestamptz,
  unique (id, agencia_id),
  foreign key (saida_id, agencia_id) references public.saidas (id, agencia_id),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id)
);
create index reservas_saida_idx on public.reservas (saida_id, situacao);
create index reservas_cliente_idx on public.reservas (cliente_id);

revoke all on public.reservas from anon, authenticated;
grant select on public.reservas to authenticated;
alter table public.reservas enable row level security;
create policy reservas_select on public.reservas
  for select to authenticated using (private.e_membro(agencia_id));

-- Seats per departure.
create view public.v_saidas_vagas with (security_invoker = true) as
select s.id, s.agencia_id, s.passeio_id, s.data, s.capacidade, s.preco_centavos, s.situacao,
       coalesce(sum(r.qtd_pessoas) filter (where r.situacao = 'ativa'), 0)::int as reservadas,
       (s.capacidade - coalesce(sum(r.qtd_pessoas) filter (where r.situacao = 'ativa'), 0))::int as livres
from public.saidas s
left join public.reservas r on r.saida_id = s.id
group by s.id;
revoke all on public.v_saidas_vagas from anon, authenticated;
grant select on public.v_saidas_vagas to authenticated;

-- Custom errors: CR001 no seats, CR002 departure not open, CR003 capacity below reservations,
-- CR004 already cancelled.
create function public.criar_reserva(
  p_saida uuid, p_cliente uuid, p_qtd integer, p_valor_total integer default null, p_observacao text default null
) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare
  v_saida public.saidas;
  v_reservadas integer;
  v_total bigint;
  v_id uuid;
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
  returning id into v_id;     -- the composite foreign key refuses a client of another agency (23503)
  return v_id;
end;
$$;

create function public.cancelar_reserva(p_reserva uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_reserva public.reservas;
begin
  select r.* into v_reserva from public.reservas r where r.id = p_reserva for update;
  if not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  if v_reserva.situacao = 'cancelada' then
    raise exception 'A reserva já está cancelada' using errcode = 'CR004';
  end if;
  update public.reservas set situacao = 'cancelada', cancelada_em = now() where id = p_reserva;
end;
$$;

revoke all on function public.criar_reserva(uuid, uuid, integer, integer, text), public.cancelar_reserva(uuid) from public, anon;
grant execute on function public.criar_reserva(uuid, uuid, integer, integer, text), public.cancelar_reserva(uuid) to authenticated;

-- Capacity can never drop below the seats already sold.
create function private.proteger_capacidade() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.capacidade < (
    select coalesce(sum(r.qtd_pessoas), 0) from public.reservas r where r.saida_id = new.id and r.situacao = 'ativa'
  ) then
    raise exception 'A capacidade não pode ser menor que as vagas já reservadas' using errcode = 'CR003';
  end if;
  return new;
end;
$$;
create trigger proteger_capacidade before update of capacidade on public.saidas
  for each row execute function private.proteger_capacidade();

-- Deleting the account: reservations first, then departures, then the rest (foreign key order).
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

  delete from public.reservas where agencia_id = v_agencia;
  delete from public.saidas where agencia_id = v_agencia;
  delete from public.agencias where id = v_agencia;          -- cascades to the rest and to members
  delete from auth.users where id = any (v_usuarios);
end;
$$;
