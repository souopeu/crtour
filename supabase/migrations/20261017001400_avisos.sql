-- Notices for the owner (a deal was won) and the loss reason kept in the stage history.
alter table public.negociacao_eventos add column motivo public.motivo_perda;   -- set only on the move to "perdido"

create type public.tipo_aviso as enum ('negociacao_ganha');

create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  tipo public.tipo_aviso not null,
  negociacao_id uuid,
  titulo text not null,                 -- snapshots, so the notice reads right even if the deal changes later
  cliente_nome text not null,
  valor_centavos integer not null,
  por uuid references auth.users (id) on delete set null,
  por_nome text,
  lido_em timestamptz,
  criado_em timestamptz not null default now(),
  foreign key (negociacao_id, agencia_id) references public.negociacoes (id, agencia_id)
);
create index avisos_agencia_idx on public.avisos (agencia_id, lido_em, criado_em desc);

revoke all on public.avisos from anon, authenticated;
grant select on public.avisos to authenticated;
grant update (lido_em) on public.avisos to authenticated;      -- the only thing the owner can change
alter table public.avisos enable row level security;
create policy avisos_select on public.avisos for select to authenticated using (private.e_dono(agencia_id));
create policy avisos_update on public.avisos for update to authenticated
  using (private.e_dono(agencia_id)) with check (private.e_dono(agencia_id));

-- Stage history now keeps the reason, and winning (entering "pago" or later from an open stage) notifies the owner.
create or replace function private.registrar_evento_negociacao() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_ganhou boolean := false;
begin
  if tg_op = 'INSERT' then
    insert into public.negociacao_eventos (agencia_id, negociacao_id, de, para, por, motivo)
    values (new.agencia_id, new.id, null, new.etapa, (select auth.uid()), case when new.etapa = 'perdido' then new.motivo_perda end);
    v_ganhou := private.etapa_ganha(new.etapa);
  elsif new.etapa is distinct from old.etapa then
    insert into public.negociacao_eventos (agencia_id, negociacao_id, de, para, por, motivo)
    values (new.agencia_id, new.id, old.etapa, new.etapa, (select auth.uid()), case when new.etapa = 'perdido' then new.motivo_perda end);
    v_ganhou := private.etapa_ganha(new.etapa) and not private.etapa_ganha(old.etapa);
  end if;

  if v_ganhou then
    insert into public.avisos (agencia_id, tipo, negociacao_id, titulo, cliente_nome, valor_centavos, por, por_nome)
    select new.agencia_id, 'negociacao_ganha', new.id, new.titulo, c.nome, new.valor_centavos, (select auth.uid()), m.nome
    from public.clientes c
    left join public.membros m on m.user_id = (select auth.uid())
    where c.id = new.cliente_id;
  end if;
  return null;
end;
$$;

-- Deleting the account: notices go before the deals they point to.
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

  delete from public.avisos where agencia_id = v_agencia;
  delete from public.negociacao_eventos where agencia_id = v_agencia;
  delete from public.negociacoes where agencia_id = v_agencia;
  delete from public.pagamentos where agencia_id = v_agencia;
  delete from public.passageiros where agencia_id = v_agencia;
  delete from public.reservas where agencia_id = v_agencia;
  delete from public.saidas where agencia_id = v_agencia;
  delete from public.agencias where id = v_agencia;          -- cascades to the rest and to members
  delete from auth.users where id = any (v_usuarios);
end;
$$;
