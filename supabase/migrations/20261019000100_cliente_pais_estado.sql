-- E8-2 (R126): country and state of the client. Existing clients become "Brasil" with no state;
-- nothing is guessed from the city. In Brazil the state is one of the 27 UFs; abroad it is free text.
alter table public.clientes
  add column pais text not null default 'Brasil' check (char_length(btrim(pais)) between 1 and 60),
  add column estado text check (char_length(estado) <= 60),
  add constraint clientes_estado_uf check (
    pais <> 'Brasil' or estado is null or estado in (
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
      'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'));

grant update (pais, estado) on public.clientes to authenticated;

-- Same search as before, plus a state filter and the state in each row.
drop function public.buscar_clientes(text, uuid, public.origem_lead, text, integer, integer);

create function public.buscar_clientes(
  p_busca text default null,
  p_etiqueta uuid default null,
  p_origem public.origem_lead default null,
  p_cidade text default null,
  p_limite integer default 25,
  p_deslocamento integer default 0,
  p_estado text default null
) returns table (
  id uuid, nome text, whatsapp text, email text, cidade text, estado text,
  origem public.origem_lead, consentimento_whatsapp public.consentimento_whatsapp, total bigint
)
  language plpgsql stable security invoker set search_path = '' as $$
declare
  v_busca text := btrim(coalesce(p_busca, ''));
  v_digitos text := regexp_replace(btrim(coalesce(p_busca, '')), '\D', '', 'g');
  v_telefone boolean := v_busca <> '' and v_busca ~ '^[0-9\s()+.\-]+$' and length(v_digitos) >= 3;
  v_termos text[] := array[]::text[];
  v_cidade text := nullif(btrim(coalesce(p_cidade, '')), '');
  v_estado text := nullif(btrim(coalesce(p_estado, '')), '');
begin
  if v_busca <> '' and not v_telefone then
    v_termos := array(
      select replace(replace(replace(u.t, '\', '\\'), '%', '\%'), '_', '\_')
      from unnest(regexp_split_to_array(extensions.unaccent(lower(v_busca)), '\s+')) as u(t)
    );
  end if;

  return query
  select c.id, c.nome, c.whatsapp, c.email, c.cidade, c.estado, c.origem, c.consentimento_whatsapp, count(*) over ()
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
    and (v_estado is null or extensions.unaccent(lower(c.estado)) = extensions.unaccent(lower(v_estado)))
  order by extensions.unaccent(lower(c.nome)), c.id
  limit least(greatest(p_limite, 1), 100)
  offset greatest(p_deslocamento, 0);
end;
$$;

revoke all on function public.buscar_clientes(text, uuid, public.origem_lead, text, integer, integer, text) from public, anon;
grant execute on function public.buscar_clientes(text, uuid, public.origem_lead, text, integer, integer, text) to authenticated;

-- Distinct states of the caller's clients (for the filter dropdown).
create function public.estados_dos_clientes() returns table (estado text)
  language sql stable security invoker set search_path = '' as $$
  select min(c.estado)
  from public.clientes c
  where c.estado is not null
  group by extensions.unaccent(lower(c.estado))
  order by extensions.unaccent(lower(min(c.estado)))
  limit 300;
$$;

revoke all on function public.estados_dos_clientes() from public, anon;
grant execute on function public.estados_dos_clientes() to authenticated;

-- Import: new clients take the optional País and Estado columns (validated in the app like the form).
-- shortcut: clients already registered get no suggestion for country/state; add them to the suggestions if asked.
create or replace function public.importar_clientes(p_nome text, p_hash text, p_linhas jsonb) returns jsonb
  language plpgsql security invoker set search_path = '' as $$
declare
  v_agencia uuid;
  v_id uuid;
  v_total integer;
  v_novas integer[];
  v_existentes integer[];
  v_atualizacao jsonb;
begin
  select m.agencia_id into v_agencia from public.membros m where m.user_id = (select auth.uid());
  if v_agencia is null then
    raise exception 'Usuário sem agência' using errcode = '42501';
  end if;

  v_total := jsonb_array_length(p_linhas);
  if v_total > 5000 then
    raise exception 'A planilha pode ter no máximo 5.000 linhas' using errcode = '22023';
  end if;

  select coalesce(array_agg(c.linha) filter (where c.situacao = 'nova'), '{}'),
         coalesce(array_agg(c.linha) filter (where c.situacao = 'ja_cadastrada'), '{}')
    into v_novas, v_existentes
  from public.classificar_linhas_importacao(p_linhas) c;

  insert into public.importacoes (agencia_id, nome, hash_arquivo, total_linhas, qtd_criados, qtd_ignorados)
  values (v_agencia, p_nome, p_hash, v_total, cardinality(v_novas), v_total - cardinality(v_novas))
  returning id into v_id;

  insert into public.etiquetas (agencia_id, nome)
  select distinct on (lower(t.nome)) v_agencia, t.nome
  from (
    select regexp_replace(btrim(x), '\s+', ' ', 'g') as nome
    from jsonb_array_elements(p_linhas) as r,
         jsonb_array_elements_text(coalesce(r -> 'etiquetas', '[]'::jsonb)) as x
    where (r ->> 'linha')::int = any (v_novas) and btrim(x) <> ''
  ) t
  on conflict (agencia_id, lower(nome)) do nothing;

  with src as (
    select gen_random_uuid() as id, r
    from jsonb_array_elements(p_linhas) as r
    where (r ->> 'linha')::int = any (v_novas)
  ),
  ins as (
    insert into public.clientes (
      id, agencia_id, importacao_id, nome, whatsapp, email, pais, estado, cidade, aniversario, origem, destinos_interesse,
      faixa_orcamento, qtd_pessoas, restricoes, passaporte_validade, consentimento_whatsapp)
    select s.id, v_agencia, v_id, s.r ->> 'nome', nullif(s.r ->> 'whatsapp', ''), nullif(s.r ->> 'email', ''),
           coalesce(nullif(s.r ->> 'pais', ''), 'Brasil'), nullif(s.r ->> 'estado', ''),
           nullif(s.r ->> 'cidade', ''), nullif(s.r ->> 'aniversario', '')::date,
           nullif(s.r ->> 'origem', '')::public.origem_lead,
           coalesce(array(select jsonb_array_elements_text(coalesce(s.r -> 'destinos_interesse', '[]'::jsonb))), '{}'),
           nullif(s.r ->> 'faixa_orcamento', ''), nullif(s.r ->> 'qtd_pessoas', '')::int,
           nullif(s.r ->> 'restricoes', ''), nullif(s.r ->> 'passaporte_validade', '')::date,
           coalesce(nullif(s.r ->> 'consentimento_whatsapp', ''), 'nao_informado')::public.consentimento_whatsapp
    from src s
    returning id
  )
  insert into public.cliente_etiquetas (cliente_id, etiqueta_id, agencia_id)
  select distinct s.id, e.id, v_agencia
  from src s
  join ins on ins.id = s.id
  cross join lateral jsonb_array_elements_text(coalesce(s.r -> 'etiquetas', '[]'::jsonb)) as x
  join public.etiquetas e on lower(e.nome) = lower(regexp_replace(btrim(x), '\s+', ' ', 'g'))
  where btrim(x) <> '';

  v_atualizacao := private.aplicar_linhas_existentes(v_agencia, v_id, p_linhas, v_existentes);

  return jsonb_build_object('importacao_id', v_id, 'criados', cardinality(v_novas), 'ignoradas', v_total - cardinality(v_novas))
    || v_atualizacao;
end;
$$;
