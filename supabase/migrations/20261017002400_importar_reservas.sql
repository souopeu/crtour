-- E4-2 (R44–R47): import reservations from a spreadsheet. Never guesses: client, tour and departure must exist.
create table public.importacoes_reservas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 200),
  hash_arquivo text not null check (hash_arquivo ~ '^[0-9a-f]{64}$'),
  qtd_criadas integer not null default 0,
  qtd_recusadas integer not null default 0,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criada_em timestamptz not null default now(),
  unique (agencia_id, hash_arquivo),
  unique (id, agencia_id)
);
alter table public.reservas add column importacao_id uuid;
alter table public.reservas add constraint reservas_importacao_fk
  foreign key (importacao_id, agencia_id) references public.importacoes_reservas (id, agencia_id) on delete set null (importacao_id);
create index reservas_importacao_idx on public.reservas (importacao_id) where importacao_id is not null;

revoke all on public.importacoes_reservas from anon, authenticated;
grant select on public.importacoes_reservas to authenticated;
alter table public.importacoes_reservas enable row level security;
create policy importacoes_reservas_select on public.importacoes_reservas for select to authenticated using (private.e_membro(agencia_id));

-- One row of the sheet -> client and departure of the agency, or why not.
create function private.resolver_linha_reserva(p_agencia uuid, e jsonb,
  out cliente_id uuid, out saida_id uuid, out vagas_livres integer, out problema text)
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_clientes uuid[];
  v_passeios uuid[];
  v_saida public.saidas;
begin
  select array_agg(c.id) into v_clientes from public.clientes c
  where c.agencia_id = p_agencia
    and ((nullif(e->>'whatsapp', '') is not null and c.whatsapp = e->>'whatsapp')
      or (nullif(e->>'email', '') is not null and lower(c.email) = lower(btrim(e->>'email'))));
  if coalesce(cardinality(v_clientes), 0) = 0 then problema := 'cliente_nao_encontrado'; return; end if;
  if cardinality(v_clientes) > 1 then problema := 'cliente_ambiguo'; return; end if;

  select array_agg(p.id) into v_passeios from public.passeios p
  where p.agencia_id = p_agencia and lower(btrim(p.nome)) = lower(btrim(coalesce(e->>'passeio', '')));
  if coalesce(cardinality(v_passeios), 0) = 0 then problema := 'passeio_nao_encontrado'; return; end if;
  if cardinality(v_passeios) > 1 then problema := 'passeio_ambiguo'; return; end if;

  select s.* into v_saida from public.saidas s
  where s.passeio_id = v_passeios[1] and s.data = (e->>'data')::date and s.situacao <> 'cancelada'
  order by s.situacao = 'aberta' desc limit 1;
  if not found then problema := 'saida_nao_encontrada'; return; end if;
  if v_saida.situacao <> 'aberta' then problema := 'saida_fechada'; return; end if;

  cliente_id := v_clientes[1];
  saida_id := v_saida.id;
  vagas_livres := v_saida.capacidade - (select coalesce(sum(r.qtd_pessoas), 0)::int from public.reservas r where r.saida_id = v_saida.id and r.situacao = 'ativa');
end;
$$;
revoke all on function private.resolver_linha_reserva(uuid, jsonb) from public, anon, authenticated;

create function private.agencia_do_usuario() returns uuid
  language sql stable security definer set search_path = '' as $$
  select m.agencia_id from public.membros m where m.user_id = (select auth.uid())
$$;
revoke all on function private.agencia_do_usuario() from public, anon, authenticated;

-- Preview: nothing is written.
create function public.conferir_reservas_importacao(p_linhas jsonb)
returns table (linha integer, cliente_id uuid, saida_id uuid, vagas_livres integer, problema text)
  language sql stable security definer set search_path = '' as $$
  select (e->>'linha')::int, r.cliente_id, r.saida_id, r.vagas_livres, r.problema
  from jsonb_array_elements(p_linhas) e
  cross join lateral private.resolver_linha_reserva(private.agencia_do_usuario(), e) r
  where private.agencia_do_usuario() is not null
$$;

-- Import: each row in its own sub-transaction, through criar_reserva / registrar_pagamento (same locks and rules).
create function public.importar_reservas(p_nome text, p_hash text, p_linhas jsonb) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid := private.agencia_do_usuario();
  v_imp uuid;
  e jsonb;
  v_res record;
  v_reserva uuid;
  v_total integer;
  v_pago integer;
  v_criadas integer := 0;
  v_recusadas jsonb := '[]'::jsonb;
begin
  if v_agencia is null then raise exception 'Sem agência' using errcode = '42501'; end if;
  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) > 5000 then
    raise exception 'Linhas inválidas' using errcode = '22023';
  end if;
  insert into public.importacoes_reservas (agencia_id, nome, hash_arquivo) values (v_agencia, left(p_nome, 200), p_hash) returning id into v_imp;

  for e in select * from jsonb_array_elements(p_linhas) order by (value->>'linha')::int loop
    begin
      v_res := private.resolver_linha_reserva(v_agencia, e);
      if v_res.problema is not null then raise exception '%', v_res.problema using errcode = 'CR013'; end if;
      v_reserva := public.criar_reserva(v_res.saida_id, v_res.cliente_id, (e->>'pessoas')::int, (e->>'total')::int, 'Importada da planilha');
      update public.reservas set importacao_id = v_imp where id = v_reserva returning valor_total_centavos into v_total;
      v_pago := coalesce((e->>'pago')::int, 0);
      if v_pago > 0 then
        perform public.registrar_pagamento(v_reserva, v_pago,
          (case when v_pago >= v_total then 'saldo' else 'sinal' end)::public.tipo_pagamento,
          (e->>'forma')::public.forma_pagamento, (e->>'data_pagamento')::date, 'Importado da planilha');
      end if;
      v_criadas := v_criadas + 1;
    exception when others then
      v_recusadas := v_recusadas || jsonb_build_object('linha', (e->>'linha')::int,
        'codigo', case when sqlstate = 'CR013' then sqlerrm else sqlstate end);
    end;
  end loop;

  update public.importacoes_reservas set qtd_criadas = v_criadas, qtd_recusadas = jsonb_array_length(v_recusadas) where id = v_imp;
  return jsonb_build_object('id', v_imp, 'criadas', v_criadas, 'recusadas', v_recusadas);
end;
$$;

-- Undo only while nobody touched those reservations (no later payment, companion or cancellation).
create function public.desfazer_importacao_reservas(p_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_imp public.importacoes_reservas;
begin
  select * into v_imp from public.importacoes_reservas where id = p_id for update;
  if not found or not private.e_membro(v_imp.agencia_id) then
    raise exception 'Importação não encontrada' using errcode = '42501';
  end if;
  if exists (select 1 from public.reservas r where r.importacao_id = p_id and (
       r.situacao <> 'ativa'
       or exists (select 1 from public.passageiros pa where pa.reserva_id = r.id)
       or exists (select 1 from public.pagamentos pg where pg.reserva_id = r.id and pg.criado_em > v_imp.criada_em))) then
    raise exception 'As reservas desta importação já foram alteradas' using errcode = 'CR012';
  end if;
  delete from public.pagamentos where reserva_id in (select id from public.reservas where importacao_id = p_id);
  delete from public.reservas where importacao_id = p_id;
  delete from public.importacoes_reservas where id = p_id;
end;
$$;

revoke all on function public.conferir_reservas_importacao(jsonb), public.importar_reservas(text, text, jsonb), public.desfazer_importacao_reservas(uuid) from public, anon;
grant execute on function public.conferir_reservas_importacao(jsonb), public.importar_reservas(text, text, jsonb), public.desfazer_importacao_reservas(uuid) to authenticated;
