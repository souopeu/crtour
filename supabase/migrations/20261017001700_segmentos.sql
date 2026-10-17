-- E3-5: saved segments for remarketing, one-by-one WhatsApp sends with consent, no repeats per round.

create table public.segmentos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  criterios jsonb not null default '{}' check (jsonb_typeof(criterios) = 'object' and pg_column_size(criterios) < 2000),
  mensagem text not null default '' check (char_length(mensagem) <= 1000),
  rodada integer not null default 1 check (rodada between 1 and 100000), -- "Começar nova rodada" = may call everyone again
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (id, agencia_id)
);
create unique index segmentos_nome_unico on public.segmentos (agencia_id, lower(nome));

create table public.segmento_envios (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  segmento_id uuid not null,
  cliente_id uuid not null,
  rodada integer not null,
  atividade_id uuid references public.atividades (id) on delete set null,
  enviado_por uuid default auth.uid() references auth.users (id) on delete set null,
  enviado_em timestamptz not null default now(),
  foreign key (segmento_id, agencia_id) references public.segmentos (id, agencia_id) on delete cascade,
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id) on delete cascade,
  unique (segmento_id, rodada, cliente_id)
);
create index segmento_envios_cliente_idx on public.segmento_envios (cliente_id);

-- Every send: only consent "aceitou" (CR009); the round is always the segment's current one.
create function private.preparar_envio() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.clientes c where c.id = new.cliente_id and c.agencia_id = new.agencia_id and c.consentimento_whatsapp = 'aceitou') then
    raise exception 'Cliente sem consentimento para mensagens' using errcode = 'CR009';
  end if;
  select s.rodada into new.rodada from public.segmentos s where s.id = new.segmento_id and s.agencia_id = new.agencia_id;
  return new;
end;
$$;
revoke all on function private.preparar_envio() from public, anon, authenticated;
create trigger preparar_envio before insert on public.segmento_envios for each row execute function private.preparar_envio();

-- R36: clients matching the criteria (all optional, combined with AND). Runs as the caller, so RLS keeps it to the agency.
create function public.clientes_do_segmento(p jsonb)
returns table (id uuid, nome text, whatsapp text, consentimento_whatsapp public.consentimento_whatsapp, destino text, ultima_interacao_em timestamptz)
  language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d)
  select c.id, c.nome, c.whatsapp, c.consentimento_whatsapp,
    coalesce(
      (select x from unnest(c.destinos_interesse) x where p ? 'destino' and strpos(lower(x), lower(p->>'destino')) > 0 limit 1),
      c.destinos_interesse[1]),
    c.ultima_interacao_em
  from public.clientes c, hoje
  where (not p ? 'etiqueta' or exists (select 1 from public.cliente_etiquetas ce where ce.cliente_id = c.id and ce.etiqueta_id = (p->>'etiqueta')::uuid))
    and (not p ? 'destino' or exists (select 1 from unnest(c.destinos_interesse) x where strpos(lower(x), lower(p->>'destino')) > 0))
    and (not p ? 'origem' or c.origem::text = p->>'origem')
    and (not p ? 'cidade' or lower(c.cidade) = lower(p->>'cidade'))
    and (not p ? 'aniversarioMes' or extract(month from c.aniversario) = (p->>'aniversarioMes')::int)
    -- same rule as the "Hoje" screen: X or more Brazilian calendar days, from registration when never contacted
    and (not p ? 'semContatoDias' or coalesce(c.ultima_interacao_em, c.criado_em) < ((hoje.d - ((p->>'semContatoDias')::int - 1))::timestamp at time zone 'America/Sao_Paulo'))
    and (not p ? 'motivoPerda' or exists (select 1 from public.negociacoes n where n.cliente_id = c.id and n.etapa = 'perdido' and n.motivo_perda::text = p->>'motivoPerda'))
    and (not p ? 'passaporteMeses' or c.passaporte_validade <= (hoje.d + make_interval(months => (p->>'passaporteMeses')::int))::date)
  order by lower(c.nome), c.id
  limit 2000
$$;

-- R37/R38: one send = done WhatsApp activity + mark in the round, atomically. Repeats in the round are refused (CR010).
create function public.registrar_envio_segmento(p_segmento uuid, p_cliente uuid, p_mensagem text) returns void
  language plpgsql security invoker set search_path = '' as $$
declare
  v_seg public.segmentos;
  v_atividade uuid;
  v_envio uuid;
  v_resumo text := left(regexp_replace(btrim(coalesce(p_mensagem, '')), '\s+', ' ', 'g'), 120);
begin
  select * into v_seg from public.segmentos where id = p_segmento;
  if v_seg.id is null then
    raise exception 'Segmento não encontrado' using errcode = 'P0002';
  end if;
  insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status)
  values (v_seg.agencia_id, p_cliente, 'whatsapp', left(format('Remarketing (%s): %s', v_seg.nome, v_resumo), 200), now(), 'feito')
  returning id into v_atividade;
  insert into public.segmento_envios (agencia_id, segmento_id, cliente_id, atividade_id)
  values (v_seg.agencia_id, p_segmento, p_cliente, v_atividade)
  on conflict (segmento_id, rodada, cliente_id) do nothing
  returning id into v_envio;
  if v_envio is null then
    raise exception 'Cliente já chamado nesta rodada' using errcode = 'CR010'; -- rolls back the activity too
  end if;
end;
$$;

revoke all on public.segmentos, public.segmento_envios from anon, authenticated;
grant select, delete on public.segmentos to authenticated;
grant insert (agencia_id, nome, criterios, mensagem) on public.segmentos to authenticated;
grant update (nome, mensagem, rodada) on public.segmentos to authenticated;
grant select on public.segmento_envios to authenticated;
grant insert (agencia_id, segmento_id, cliente_id, atividade_id) on public.segmento_envios to authenticated;
revoke all on function public.clientes_do_segmento(jsonb), public.registrar_envio_segmento(uuid, uuid, text) from public, anon;
grant execute on function public.clientes_do_segmento(jsonb), public.registrar_envio_segmento(uuid, uuid, text) to authenticated;

alter table public.segmentos enable row level security;
alter table public.segmento_envios enable row level security;
create policy segmentos_select on public.segmentos for select to authenticated using (private.e_membro(agencia_id));
create policy segmentos_insert on public.segmentos for insert to authenticated with check (private.e_membro(agencia_id));
create policy segmentos_update on public.segmentos for update to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy segmentos_delete on public.segmentos for delete to authenticated using (private.e_membro(agencia_id));
create policy envios_select on public.segmento_envios for select to authenticated using (private.e_membro(agencia_id));
create policy envios_insert on public.segmento_envios for insert to authenticated with check (private.e_membro(agencia_id));

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

  delete from public.segmento_envios where agencia_id = v_agencia;
  delete from public.segmentos where agencia_id = v_agencia;
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
