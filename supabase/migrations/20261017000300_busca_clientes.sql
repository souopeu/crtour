-- Client search: ignores case and accents, every typed word must match the name or e-mail;
-- a query made only of phone characters matches the WhatsApp digits. LIKE wildcards typed by
-- the user are escaped. SECURITY INVOKER: RLS still limits rows to the caller's agency.
create extension if not exists unaccent with schema extensions;

create function public.buscar_clientes(
  p_busca text default null,
  p_etiqueta uuid default null,
  p_origem public.origem_lead default null,
  p_cidade text default null,
  p_limite integer default 25,
  p_deslocamento integer default 0
) returns table (
  id uuid, nome text, whatsapp text, email text, cidade text,
  origem public.origem_lead, consentimento_whatsapp public.consentimento_whatsapp, total bigint
)
  language plpgsql stable security invoker set search_path = '' as $$
declare
  v_busca text := btrim(coalesce(p_busca, ''));
  v_digitos text := regexp_replace(btrim(coalesce(p_busca, '')), '\D', '', 'g');
  v_telefone boolean := v_busca <> '' and v_busca ~ '^[0-9\s()+.\-]+$' and length(v_digitos) >= 3;
  v_termos text[] := array[]::text[];
  v_cidade text := nullif(btrim(coalesce(p_cidade, '')), '');
begin
  if v_busca <> '' and not v_telefone then
    v_termos := array(
      select replace(replace(replace(u.t, '\', '\\'), '%', '\%'), '_', '\_')
      from unnest(regexp_split_to_array(extensions.unaccent(lower(v_busca)), '\s+')) as u(t)
    );
  end if;

  return query
  select c.id, c.nome, c.whatsapp, c.email, c.cidade, c.origem, c.consentimento_whatsapp, count(*) over ()
  from public.clientes c
  where (
      v_busca = ''
      or (v_telefone and c.whatsapp like '%' || v_digitos || '%')
      or (not v_telefone and not exists (
            select 1 from unnest(v_termos) as u(t)
            where not (
              extensions.unaccent(lower(c.nome)) like '%' || u.t || '%'
              or extensions.unaccent(lower(coalesce(c.email, ''))) like '%' || u.t || '%'
            )))
    )
    and (p_etiqueta is null or exists (
          select 1 from public.cliente_etiquetas ce where ce.cliente_id = c.id and ce.etiqueta_id = p_etiqueta))
    and (p_origem is null or c.origem = p_origem)
    and (v_cidade is null or extensions.unaccent(lower(c.cidade)) = extensions.unaccent(lower(v_cidade)))
  order by extensions.unaccent(lower(c.nome)), c.id
  limit least(greatest(p_limite, 1), 100)
  offset greatest(p_deslocamento, 0);
end;
$$;

revoke all on function public.buscar_clientes(text, uuid, public.origem_lead, text, integer, integer) from public, anon;
grant execute on function public.buscar_clientes(text, uuid, public.origem_lead, text, integer, integer) to authenticated;

-- Distinct cities of the caller's clients (for the filter dropdown).
create function public.cidades_dos_clientes() returns table (cidade text)
  language sql stable security invoker set search_path = '' as $$
  select min(c.cidade)
  from public.clientes c
  where c.cidade is not null
  group by extensions.unaccent(lower(c.cidade))
  order by extensions.unaccent(lower(min(c.cidade)))
  limit 300;
$$;

revoke all on function public.cidades_dos_clientes() from public, anon;
grant execute on function public.cidades_dos_clientes() to authenticated;
