-- E9-5 (R142): "serviço sob medida" — a one-off service (transfer, private tour…) sold without a catalogue tour.
-- It is a hidden tour (sob_medida) with one departure of exactly the seats sold, and the reservation:
-- every reservation still has a departure, so boarding, status, payments and reports work the same way.
alter table public.passeios add column sob_medida boolean not null default false;

create function public.criar_servico_sob_medida(
  p_cliente uuid, p_nome text, p_data date, p_horario time, p_qtd integer, p_valor_total integer, p_observacao text default null
) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
  v_passeio uuid;
  v_saida uuid;
begin
  select c.agencia_id into v_agencia from public.clientes c where c.id = p_cliente;
  if v_agencia is null or not private.e_membro(v_agencia) then
    raise exception 'Cliente não encontrado' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_nome, ''))) not between 1 and 120 or p_data is null
     or p_qtd is null or p_qtd not between 1 and 500 or p_valor_total is null or p_valor_total not between 0 and 1000000000 then
    raise exception 'Dados do serviço inválidos' using errcode = '22023';
  end if;

  insert into public.passeios (agencia_id, nome, sob_medida) values (v_agencia, btrim(p_nome), true) returning id into v_passeio;
  insert into public.saidas (agencia_id, passeio_id, data, horario, capacidade, preco_centavos)
  values (v_agencia, v_passeio, p_data, p_horario, p_qtd, p_valor_total / p_qtd) returning id into v_saida;
  return public.criar_reserva(v_saida, p_cliente, p_qtd, p_valor_total, p_observacao); -- same lock and checks as any reservation
end;
$$;

revoke all on function public.criar_servico_sob_medida(uuid, text, date, time, integer, integer, text) from public, anon;
grant execute on function public.criar_servico_sob_medida(uuid, text, date, time, integer, integer, text) to authenticated;

-- Global search: tailor-made services are not catalogue tours (they still show as reservations and departures).
create or replace function public.busca_global(p_busca text)
  returns table (tipo text, id uuid, titulo text, detalhe text, data date)
  language plpgsql stable security invoker set search_path = '' as $$
declare
  v_busca text := btrim(left(coalesce(p_busca, ''), 100));
  v_termos text[];
begin
  if char_length(v_busca) < 2 then
    return;
  end if;
  -- same LIKE escaping as buscar_clientes: typed wildcards are literal
  v_termos := array(
    select replace(replace(replace(u.t, '\', '\\'), '%', '\%'), '_', '\_')
    from unnest(regexp_split_to_array(extensions.unaccent(lower(v_busca)), '\s+')) as u(t)
  );

  return query
  select 'cliente'::text, c.id, c.nome, coalesce(c.whatsapp, c.email), null::date
  from public.buscar_clientes(p_busca => v_busca, p_limite => 5) c;

  return query
  select 'negociacao'::text, n.id, n.titulo, c.nome, null::date
  from public.negociacoes n
  join public.clientes c on c.id = n.cliente_id
  where not exists (
    select 1 from unnest(v_termos) as u(t)
    where not (
      extensions.unaccent(lower(n.titulo)) like '%' || u.t || '%'
      or extensions.unaccent(lower(c.nome)) like '%' || u.t || '%'
    ))
  order by n.atualizado_em desc, n.id
  limit 5;

  return query
  select 'passeio'::text, p.id, p.nome, p.destino,
    (select min(s.data) from public.saidas s
     where s.passeio_id = p.id and s.situacao = 'aberta' and s.data >= current_date)
  from public.passeios p
  where not p.arquivado and not p.sob_medida
    and not exists (
      select 1 from unnest(v_termos) as u(t)
      where not (
        extensions.unaccent(lower(p.nome)) like '%' || u.t || '%'
        or extensions.unaccent(lower(coalesce(p.destino, ''))) like '%' || u.t || '%'
      ))
  order by extensions.unaccent(lower(p.nome)), p.id
  limit 5;
end;
$$;
