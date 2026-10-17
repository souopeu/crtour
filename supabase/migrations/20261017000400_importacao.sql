-- Spreadsheet import: one `importacoes` row per file; clients created by it point to it,
-- so deleting the import undoes everything it created (ON DELETE CASCADE).
create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 200),
  hash_arquivo text not null check (char_length(hash_arquivo) between 8 and 128),
  total_linhas integer not null default 0,
  qtd_criados integer not null default 0,
  qtd_ignorados integer not null default 0,
  criada_por uuid default auth.uid() references auth.users (id) on delete set null,
  criada_em timestamptz not null default now(),
  unique (id, agencia_id),
  unique (agencia_id, hash_arquivo)
);

alter table public.clientes add column importacao_id uuid;
alter table public.clientes
  add foreign key (importacao_id, agencia_id) references public.importacoes (id, agencia_id) on delete cascade;
create index clientes_importacao_idx on public.clientes (importacao_id);

revoke all on public.importacoes from anon, authenticated;
grant select, insert, delete on public.importacoes to authenticated;
alter table public.importacoes enable row level security;
create policy importacoes_all on public.importacoes
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));

-- Duplicate key: WhatsApp, else e-mail, else name (+ birthday). Single source of truth.
create function private.chave_cliente(p_whatsapp text, p_email text, p_nome text, p_aniversario date)
  returns text language sql stable set search_path = '' as $$
  select case
    when nullif(p_whatsapp, '') is not null then 'w:' || p_whatsapp
    when nullif(btrim(p_email), '') is not null then 'e:' || lower(btrim(p_email))
    else 'n:' || extensions.unaccent(lower(btrim(p_nome))) || '|' || coalesce(p_aniversario::text, '')
  end;
$$;
revoke all on function private.chave_cliente(text, text, text, date) from public, anon;
grant execute on function private.chave_cliente(text, text, text, date) to authenticated;

create function public.classificar_linhas_importacao(p_linhas jsonb)
  returns table (linha integer, situacao text)
  language sql stable security invoker set search_path = '' as $$
  with l as (
    select (r ->> 'linha')::int as linha, r ->> 'nome' as nome, nullif(r ->> 'whatsapp', '') as w,
           nullif(r ->> 'email', '') as e, nullif(r ->> 'aniversario', '')::date as a
    from jsonb_array_elements(p_linhas) as r
  ),
  k as (select l.linha, private.chave_cliente(l.w, l.e, l.nome, l.a) as chave from l),
  ex as (select distinct private.chave_cliente(c.whatsapp, c.email, c.nome, c.aniversario) as chave from public.clientes c),
  r as (select k.linha, k.chave, row_number() over (partition by k.chave order by k.linha) as rn from k)
  select r.linha,
         case when ex.chave is not null then 'ja_cadastrada'
              when r.rn > 1 then 'repetida_no_arquivo'
              else 'nova' end
  from r left join ex on ex.chave = r.chave
  order by r.linha;
$$;

create function public.importar_clientes(p_nome text, p_hash text, p_linhas jsonb) returns jsonb
  language plpgsql security invoker set search_path = '' as $$
declare
  v_agencia uuid;
  v_id uuid;
  v_total integer;
  v_novas integer[];
begin
  select m.agencia_id into v_agencia from public.membros m where m.user_id = (select auth.uid());
  if v_agencia is null then
    raise exception 'Usuário sem agência' using errcode = '42501';
  end if;

  v_total := jsonb_array_length(p_linhas);
  if v_total > 5000 then
    raise exception 'A planilha pode ter no máximo 5.000 linhas' using errcode = '22023';
  end if;

  select coalesce(array_agg(c.linha), '{}') into v_novas
  from public.classificar_linhas_importacao(p_linhas) c where c.situacao = 'nova';

  insert into public.importacoes (agencia_id, nome, hash_arquivo, total_linhas, qtd_criados, qtd_ignorados)
  values (v_agencia, p_nome, p_hash, v_total, cardinality(v_novas), v_total - cardinality(v_novas))
  returning id into v_id;

  -- Missing tags first (names compared ignoring case and extra spaces).
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
      id, agencia_id, importacao_id, nome, whatsapp, email, cidade, aniversario, origem, destinos_interesse,
      faixa_orcamento, qtd_pessoas, restricoes, passaporte_validade, consentimento_whatsapp)
    select s.id, v_agencia, v_id, s.r ->> 'nome', nullif(s.r ->> 'whatsapp', ''), nullif(s.r ->> 'email', ''),
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

  return jsonb_build_object('importacao_id', v_id, 'criados', cardinality(v_novas), 'ignoradas', v_total - cardinality(v_novas));
end;
$$;

revoke all on function public.classificar_linhas_importacao(jsonb), public.importar_clientes(text, text, jsonb) from public, anon;
grant execute on function public.classificar_linhas_importacao(jsonb), public.importar_clientes(text, text, jsonb) to authenticated;
