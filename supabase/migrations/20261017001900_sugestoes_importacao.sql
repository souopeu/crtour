-- Re-import of clients that already exist: a blank field is filled, a different value never
-- overwrites. The difference becomes a suggestion that a person accepts or refuses.
-- WhatsApp, name and consent are never touched by a spreadsheet.
create table public.sugestoes_cliente (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  cliente_id uuid not null,
  importacao_id uuid,
  campo text not null check (campo in (
    'cidade', 'email', 'aniversario', 'origem', 'faixa_orcamento', 'qtd_pessoas', 'restricoes', 'passaporte_validade')),
  valor_sugerido text not null check (char_length(valor_sugerido) between 1 and 254),
  criada_em timestamptz not null default now(),
  unique (cliente_id, campo, valor_sugerido),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id) on delete cascade,
  foreign key (importacao_id, agencia_id) references public.importacoes (id, agencia_id) on delete cascade
);
create index sugestoes_cliente_idx on public.sugestoes_cliente (cliente_id);

revoke all on public.sugestoes_cliente from anon, authenticated;
grant select, insert, delete on public.sugestoes_cliente to authenticated;
alter table public.sugestoes_cliente enable row level security;
create policy sugestoes_cliente_all on public.sugestoes_cliente
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));

create function private.aplicar_linhas_existentes(p_agencia uuid, p_importacao uuid, p_linhas jsonb, p_linhas_existentes integer[])
  returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_sugestoes integer;
  v_preenchidos integer;
begin
  with l as (
    select (r ->> 'linha')::int as linha, r from jsonb_array_elements(p_linhas) as r
    where (r ->> 'linha')::int = any (p_linhas_existentes)
  ),
  m as (
    select distinct on (l.linha) l.linha, l.r, c.id as cliente_id, to_jsonb(c) as atual
    from l
    join public.clientes c
      on private.chave_cliente(c.whatsapp, c.email, c.nome, c.aniversario)
       = private.chave_cliente(nullif(l.r ->> 'whatsapp', ''), nullif(l.r ->> 'email', ''), l.r ->> 'nome', nullif(l.r ->> 'aniversario', '')::date)
    order by l.linha, c.criado_em
  ),
  pares as (
    select m.cliente_id, f.campo,
           case when f.campo = 'email' then lower(btrim(m.r ->> 'email')) else btrim(m.r ->> f.campo) end as novo,
           nullif(btrim(m.atual ->> f.campo), '') as atual
    from m
    cross join (values ('cidade'), ('email'), ('aniversario'), ('origem'), ('faixa_orcamento'),
                       ('qtd_pessoas'), ('restricoes'), ('passaporte_validade')) as f (campo)
    where nullif(btrim(m.r ->> f.campo), '') is not null
  ),
  sug as (
    insert into public.sugestoes_cliente (agencia_id, cliente_id, importacao_id, campo, valor_sugerido)
    select p_agencia, p.cliente_id, p_importacao, p.campo, p.novo
    from pares p where p.atual is not null and lower(p.atual) <> lower(p.novo)
    on conflict do nothing
    returning 1
  ),
  vazios as (
    select p.cliente_id,
           max(p.novo) filter (where p.campo = 'cidade') as cidade,
           max(p.novo) filter (where p.campo = 'email') as email,
           max(p.novo) filter (where p.campo = 'aniversario') as aniversario,
           max(p.novo) filter (where p.campo = 'origem') as origem,
           max(p.novo) filter (where p.campo = 'faixa_orcamento') as faixa_orcamento,
           max(p.novo) filter (where p.campo = 'qtd_pessoas') as qtd_pessoas,
           max(p.novo) filter (where p.campo = 'restricoes') as restricoes,
           max(p.novo) filter (where p.campo = 'passaporte_validade') as passaporte_validade
    from pares p where p.atual is null group by p.cliente_id
  ),
  upd as (
    update public.clientes c set
      cidade = coalesce(nullif(btrim(c.cidade), ''), x.cidade),
      email = coalesce(nullif(btrim(c.email), ''), x.email),
      aniversario = coalesce(c.aniversario, x.aniversario::date),
      origem = coalesce(c.origem, x.origem::public.origem_lead),
      faixa_orcamento = coalesce(nullif(btrim(c.faixa_orcamento), ''), x.faixa_orcamento),
      qtd_pessoas = coalesce(c.qtd_pessoas, x.qtd_pessoas::int),
      restricoes = coalesce(nullif(btrim(c.restricoes), ''), x.restricoes),
      passaporte_validade = coalesce(c.passaporte_validade, x.passaporte_validade::date)
    from vazios x where c.id = x.cliente_id
    returning 1
  )
  select (select count(*) from sug), (select count(*) from pares p where p.atual is null)
    into v_sugestoes, v_preenchidos;

  return jsonb_build_object('preenchidos', v_preenchidos, 'sugestoes', v_sugestoes);
end;
$$;
revoke all on function private.aplicar_linhas_existentes(uuid, uuid, jsonb, integer[]) from public, anon;
grant execute on function private.aplicar_linhas_existentes(uuid, uuid, jsonb, integer[]) to authenticated;

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

  v_atualizacao := private.aplicar_linhas_existentes(v_agencia, v_id, p_linhas, v_existentes);

  return jsonb_build_object('importacao_id', v_id, 'criados', cardinality(v_novas), 'ignoradas', v_total - cardinality(v_novas))
    || v_atualizacao;
end;
$$;

-- Accept = apply the suggested value to the client and drop the suggestion.
create function public.aceitar_sugestao(p_id uuid) returns void
  language plpgsql security invoker set search_path = '' as $$
declare
  s public.sugestoes_cliente;
begin
  select * into s from public.sugestoes_cliente where id = p_id;
  if not found then
    return;
  end if;
  update public.clientes c set
    cidade = case when s.campo = 'cidade' then s.valor_sugerido else c.cidade end,
    email = case when s.campo = 'email' then s.valor_sugerido else c.email end,
    aniversario = case when s.campo = 'aniversario' then s.valor_sugerido::date else c.aniversario end,
    origem = case when s.campo = 'origem' then s.valor_sugerido::public.origem_lead else c.origem end,
    faixa_orcamento = case when s.campo = 'faixa_orcamento' then s.valor_sugerido else c.faixa_orcamento end,
    qtd_pessoas = case when s.campo = 'qtd_pessoas' then s.valor_sugerido::int else c.qtd_pessoas end,
    restricoes = case when s.campo = 'restricoes' then s.valor_sugerido else c.restricoes end,
    passaporte_validade = case when s.campo = 'passaporte_validade' then s.valor_sugerido::date else c.passaporte_validade end
  where c.id = s.cliente_id;
  delete from public.sugestoes_cliente where cliente_id = s.cliente_id and campo = s.campo;
end;
$$;
revoke all on function public.aceitar_sugestao(uuid) from public, anon;
grant execute on function public.aceitar_sugestao(uuid) to authenticated;
