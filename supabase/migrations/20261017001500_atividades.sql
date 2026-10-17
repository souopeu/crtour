-- Activities: contacts done (or to do) with a client. The client's "last interaction" is the moment of
-- the latest DONE activity; notes alone never count. It is maintained by triggers, never written by the app.
create type public.tipo_atividade as enum ('ligacao', 'whatsapp', 'email', 'reuniao', 'tarefa');
create type public.status_atividade as enum ('pendente', 'feito');

alter table public.clientes add column ultima_interacao_em timestamptz;
alter table public.negociacoes add constraint negociacoes_id_cliente_unique unique (id, cliente_id);

create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null,
  negociacao_id uuid,                                          -- optional, and always a deal of the same client
  tipo public.tipo_atividade not null,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  quando timestamptz not null,                                 -- scheduled time, or when it happened if logged as done
  status public.status_atividade not null default 'pendente',
  feito_em timestamptz,                                        -- set by the trigger
  responsavel_id uuid,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id) on delete cascade,
  foreign key (negociacao_id, cliente_id) references public.negociacoes (id, cliente_id),
  foreign key (responsavel_id, agencia_id) references public.membros (user_id, agencia_id),
  check ((status = 'feito') = (feito_em is not null))
);
create index atividades_cliente_idx on public.atividades (cliente_id, quando desc);
create index atividades_agencia_pendentes_idx on public.atividades (agencia_id, status, quando);

create function private.preparar_atividade() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.feito_em := case when new.status = 'feito' then least(new.quando, now()) end;   -- a past contact keeps its date
  elsif new.status is distinct from old.status then
    new.feito_em := case when new.status = 'feito' then now() end;
  else
    new.feito_em := old.feito_em;
  end if;
  return new;
end;
$$;
create trigger preparar_atividade before insert or update on public.atividades
  for each row execute function private.preparar_atividade();

create function private.recalcular_ultima_interacao() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_cliente uuid := coalesce(new.cliente_id, old.cliente_id);
begin
  update public.clientes c
     set ultima_interacao_em = (select max(a.feito_em) from public.atividades a where a.cliente_id = v_cliente)
   where c.id = v_cliente;
  return null;
end;
$$;
create trigger recalcular_ultima_interacao after insert or update of status, feito_em or delete on public.atividades
  for each row execute function private.recalcular_ultima_interacao();

revoke all on public.atividades from anon, authenticated;
grant select, insert, delete on public.atividades to authenticated;
grant update (tipo, titulo, quando, status, responsavel_id, negociacao_id) on public.atividades to authenticated;
alter table public.atividades enable row level security;
create policy atividades_select on public.atividades for select to authenticated using (private.e_membro(agencia_id));
create policy atividades_insert on public.atividades for insert to authenticated with check (private.e_membro(agencia_id));
create policy atividades_update on public.atividades for update to authenticated
  using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
-- The author deletes their own; the owner deletes any.
create policy atividades_delete on public.atividades for delete to authenticated
  using (private.e_membro(agencia_id) and (criado_por = (select auth.uid()) or private.e_dono(agencia_id)));

-- Deleting the account: activities go before the deals they may point to.
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

  delete from public.atividades where agencia_id = v_agencia;
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
