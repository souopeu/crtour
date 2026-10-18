-- Global search (E6-1, R76/R77): clients, deals and tours in one call, up to 5 of each.
-- Clients reuse buscar_clientes (same matching rules); deals match title or client name; tours
-- match name or destination (archived ones left out) and bring their next open departure.
-- SECURITY INVOKER: RLS limits every row to the caller's agency, so a seller finds exactly what
-- her screens already show. Fewer than 2 characters returns nothing.
create function public.busca_global(p_busca text)
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
  where not p.arquivado
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

revoke all on function public.busca_global(text) from public, anon;
grant execute on function public.busca_global(text) to authenticated;
