-- Deals (negociacoes): one sales opportunity of a client, moving through a fixed funnel.
-- The forecast (value x probability) is computed by the database; stage changes are logged in
-- negociacao_eventos, which is never edited or deleted. Deals are never deleted either: a lost
-- deal is moved to "perdido" with a reason.
create type public.etapa_negociacao as enum ('interessado', 'orcamento', 'reservado', 'pago', 'viajou', 'pos_venda', 'perdido');
create type public.motivo_perda as enum ('achou_caro', 'mudou_data', 'fechou_com_outro', 'sem_resposta', 'desistiu', 'outro');

alter table public.membros add constraint membros_user_agencia_unique unique (user_id, agencia_id);

-- Default probability per stage (to be confirmed with the client).
create function private.probabilidade_padrao(p_etapa public.etapa_negociacao) returns smallint
  language sql immutable set search_path = '' as $$
  select case p_etapa
    when 'interessado' then 10 when 'orcamento' then 30 when 'reservado' then 70
    when 'pago' then 100 when 'viajou' then 100 when 'pos_venda' then 100 else 0 end::smallint;
$$;

-- "Won" stages: from "pago" onward.
create function private.etapa_ganha(p_etapa public.etapa_negociacao) returns boolean
  language sql immutable set search_path = '' as $$
  select p_etapa in ('pago', 'viajou', 'pos_venda');
$$;

create table public.negociacoes (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  valor_centavos integer not null default 0 check (valor_centavos between 0 and 1000000000),
  etapa public.etapa_negociacao not null default 'interessado',
  probabilidade smallint not null check (probabilidade between 0 and 100),       -- filled by the trigger when omitted
  valor_previsto_centavos integer generated always as ((valor_centavos::bigint * probabilidade / 100)::integer) stored,
  responsavel_id uuid,
  data_fechamento_esperada date,
  saida_id uuid,
  fechado_em date,
  motivo_perda public.motivo_perda,
  motivo_texto text check (char_length(motivo_texto) <= 200),
  etapa_desde timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, agencia_id),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id),
  foreign key (saida_id, agencia_id) references public.saidas (id, agencia_id),
  foreign key (responsavel_id, agencia_id) references public.membros (user_id, agencia_id),
  check ((etapa = 'perdido') = (motivo_perda is not null))                        -- lost <=> has a reason
);
create index negociacoes_agencia_etapa_idx on public.negociacoes (agencia_id, etapa);
create index negociacoes_cliente_idx on public.negociacoes (cliente_id);

create table public.negociacao_eventos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  negociacao_id uuid not null,
  de public.etapa_negociacao,                                                     -- null = creation
  para public.etapa_negociacao not null,
  por uuid references auth.users (id) on delete set null,
  em timestamptz not null default clock_timestamp(),
  foreign key (negociacao_id, agencia_id) references public.negociacoes (id, agencia_id)
);
create index negociacao_eventos_negociacao_idx on public.negociacao_eventos (negociacao_id, em);

create function private.preparar_negociacao() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.probabilidade is null then
      new.probabilidade := private.probabilidade_padrao(new.etapa);
    end if;
    if private.etapa_ganha(new.etapa) then
      new.fechado_em := coalesce(new.fechado_em, private.hoje());
    end if;
  elsif new.etapa is distinct from old.etapa then
    -- a stage change applies the stage default unless the probability was set in the same edit
    if new.probabilidade is not distinct from old.probabilidade then
      new.probabilidade := private.probabilidade_padrao(new.etapa);
    end if;
    new.etapa_desde := now();
    if private.etapa_ganha(new.etapa) and not private.etapa_ganha(old.etapa) then
      new.fechado_em := private.hoje();               -- winning: today's date
    elsif not private.etapa_ganha(new.etapa) then
      new.fechado_em := null;                         -- back to an open (or lost) stage
    end if;
    if old.etapa = 'perdido' and new.etapa <> 'perdido' then
      new.motivo_perda := null;                       -- resumed: the reason no longer applies
      new.motivo_texto := null;
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger preparar_negociacao before insert or update on public.negociacoes
  for each row execute function private.preparar_negociacao();

create function private.registrar_evento_negociacao() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.negociacao_eventos (agencia_id, negociacao_id, de, para, por)
    values (new.agencia_id, new.id, null, new.etapa, (select auth.uid()));
  elsif new.etapa is distinct from old.etapa then
    insert into public.negociacao_eventos (agencia_id, negociacao_id, de, para, por)
    values (new.agencia_id, new.id, old.etapa, new.etapa, (select auth.uid()));
  end if;
  return null;
end;
$$;
create trigger registrar_evento_negociacao after insert or update of etapa on public.negociacoes
  for each row execute function private.registrar_evento_negociacao();

revoke all on public.negociacoes, public.negociacao_eventos from anon, authenticated;
grant select, insert on public.negociacoes to authenticated;
grant update (titulo, valor_centavos, etapa, probabilidade, responsavel_id, data_fechamento_esperada, saida_id, motivo_perda, motivo_texto)
  on public.negociacoes to authenticated;
grant select on public.negociacao_eventos to authenticated;

alter table public.negociacoes enable row level security;
alter table public.negociacao_eventos enable row level security;
create policy negociacoes_select on public.negociacoes for select to authenticated using (private.e_membro(agencia_id));
create policy negociacoes_insert on public.negociacoes for insert to authenticated with check (private.e_membro(agencia_id));
create policy negociacoes_update on public.negociacoes for update to authenticated
  using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy negociacao_eventos_select on public.negociacao_eventos for select to authenticated using (private.e_membro(agencia_id));

-- Deleting the account: history, deals, then the rest (foreign key order).
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
