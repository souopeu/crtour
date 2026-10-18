-- E7-2 (R77–R79): campaigns (Meta, Google) and where each lead came from. A deal belongs to a campaign when its
-- utm_campanha matches the campaign's key (case and spaces ignored), so a campaign registered later still counts old leads.
-- A sale is a deal won (pago, viajou, pos_venda), the same rule as private.etapa_ganha.

-- R77: the rest of the link's tags and the ad click ids (Google gclid, Meta fbclid).
alter table public.negociacoes
  add column utm_midia text check (char_length(utm_midia) <= 100),
  add column utm_termo text check (char_length(utm_termo) <= 100),
  add column utm_conteudo text check (char_length(utm_conteudo) <= 100),
  add column gclid text check (char_length(gclid) <= 255),
  add column fbclid text check (char_length(fbclid) <= 255);
create index negociacoes_utm_campanha_idx on public.negociacoes (agencia_id, lower(btrim(utm_campanha)));

-- The public form takes the new tags in one optional argument, so old callers keep working.
drop function public.enviar_formulario_publico(text, text, text, text, text, integer, date, text, boolean, text, text, text);

create function public.enviar_formulario_publico(
  p_codigo text, p_visitante text, p_nome text, p_whatsapp text, p_destino text, p_pessoas integer, p_data date,
  p_mensagem text, p_aceita boolean, p_origem text, p_utm_fonte text, p_utm_campanha text,
  p_extras jsonb default '{}'::jsonb
) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_form public.formularios_publicos;
  v_cliente uuid;
  v_nome_cliente text;
  v_existia boolean;
  v_neg uuid;
  v_titulo text;
  v_destino text := nullif(btrim(p_destino), '');
  v_origem public.origem_lead := case when p_origem in ('instagram', 'indicacao', 'anuncio', 'site', 'outro') then p_origem::public.origem_lead else 'site' end;
begin
  select * into v_form from public.formularios_publicos where codigo = p_codigo and ativo;
  if not found then raise exception 'Formulário indisponível' using errcode = 'P0002'; end if;

  if p_nome is null or char_length(btrim(p_nome)) not between 1 and 200
     or p_whatsapp is null or p_whatsapp !~ '^[0-9]{10,15}$'
     or char_length(v_destino) > 120 or char_length(p_mensagem) > 1000
     or (p_pessoas is not null and p_pessoas not between 1 and 500)
     or p_visitante is null or char_length(p_visitante) not between 1 and 128
     or char_length(p_utm_fonte) > 100 or char_length(p_utm_campanha) > 100
     or jsonb_typeof(coalesce(p_extras, '{}'::jsonb)) <> 'object'
     or char_length(p_extras->>'utm_midia') > 100 or char_length(p_extras->>'utm_termo') > 100 or char_length(p_extras->>'utm_conteudo') > 100
     or char_length(p_extras->>'gclid') > 255 or char_length(p_extras->>'fbclid') > 255 then
    raise exception 'Dados do formulário inválidos' using errcode = '22023';
  end if;

  -- R68: per visitor and per agency, in the last hour (old rows are dropped as we go).
  delete from public.envios_formulario where agencia_id = v_form.agencia_id and criado_em < now() - interval '1 day';
  if (select count(*) from public.envios_formulario e where e.agencia_id = v_form.agencia_id and e.visitante = p_visitante and e.criado_em > now() - interval '1 hour') >= 5
     or (select count(*) from public.envios_formulario e where e.agencia_id = v_form.agencia_id and e.criado_em > now() - interval '1 hour') >= 30 then
    raise exception 'Muitos envios. Tente de novo mais tarde.' using errcode = 'CR016';
  end if;
  insert into public.envios_formulario (agencia_id, visitante) values (v_form.agencia_id, p_visitante);

  select c.id, c.nome into v_cliente, v_nome_cliente from public.clientes c
  where c.agencia_id = v_form.agencia_id and c.whatsapp = p_whatsapp order by c.criado_em limit 1;
  v_existia := v_cliente is not null;
  if not v_existia then
    insert into public.clientes (agencia_id, nome, whatsapp, origem, destinos_interesse, qtd_pessoas, consentimento_whatsapp, consentimento_em)
    values (v_form.agencia_id, btrim(p_nome), p_whatsapp, v_origem, case when v_destino is null then '{}' else array[v_destino] end, p_pessoas,
            case when p_aceita then 'aceitou' else 'nao_informado' end::public.consentimento_whatsapp, case when p_aceita then now() end)
    returning id, nome into v_cliente, v_nome_cliente;
  end if;

  v_titulo := left('Formulário: ' || coalesce(v_destino, 'novo contato'), 200);
  insert into public.negociacoes (agencia_id, cliente_id, titulo, data_fechamento_esperada, utm_fonte, utm_campanha,
                                  utm_midia, utm_termo, utm_conteudo, gclid, fbclid)
  values (v_form.agencia_id, v_cliente, v_titulo, p_data, nullif(btrim(p_utm_fonte), ''), nullif(btrim(p_utm_campanha), ''),
          nullif(btrim(p_extras->>'utm_midia'), ''), nullif(btrim(p_extras->>'utm_termo'), ''), nullif(btrim(p_extras->>'utm_conteudo'), ''),
          nullif(btrim(p_extras->>'gclid'), ''), nullif(btrim(p_extras->>'fbclid'), ''))
  returning id into v_neg;

  insert into public.anotacoes (agencia_id, cliente_id, texto)
  values (v_form.agencia_id, v_cliente, left(concat_ws(E'\n',
    'Contato pelo formulário (origem: ' || v_origem::text || ').',
    case when v_existia then 'Nome informado: ' || btrim(p_nome) || '. Cliente já cadastrado: nada foi alterado na ficha.' end,
    case when v_destino is not null then 'Destino: ' || v_destino || '.' end,
    case when p_pessoas is not null then 'Pessoas: ' || p_pessoas || '.' end,
    case when p_data is not null then 'Data prevista: ' || to_char(p_data, 'DD/MM/YYYY') || '.' end,
    'Aceita receber mensagens: ' || case when p_aceita then 'sim' else 'não' end || '.',
    case when nullif(btrim(p_mensagem), '') is not null then 'Mensagem: ' || btrim(p_mensagem) end
  ), 4000));

  insert into public.avisos (agencia_id, tipo, negociacao_id, titulo, cliente_nome, valor_centavos)
  values (v_form.agencia_id, 'lead_formulario', v_neg, v_titulo, v_nome_cliente, 0);
end;
$$;

revoke all on function public.enviar_formulario_publico(text, text, text, text, text, integer, date, text, boolean, text, text, text, jsonb) from public;
grant execute on function public.enviar_formulario_publico(text, text, text, text, text, integer, date, text, boolean, text, text, text, jsonb) to anon, authenticated;

-- R78: campaigns, typed by the owner. `utm_campanha` is the key the ad link carries (stored lower case, trimmed).
create type public.canal_campanha as enum ('meta', 'google', 'outro');
create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  canal public.canal_campanha not null,
  utm_campanha text not null check (char_length(utm_campanha) between 1 and 100 and utm_campanha = lower(btrim(utm_campanha))),
  inicio date not null,
  fim date check (fim is null or fim >= inicio),
  gasto_centavos bigint not null default 0 check (gasto_centavos between 0 and 100000000000),
  criado_em timestamptz not null default now(),
  unique (agencia_id, utm_campanha)
);
revoke all on public.campanhas from anon, authenticated;
grant select, delete on public.campanhas to authenticated;
grant insert (agencia_id, nome, canal, utm_campanha, inicio, fim, gasto_centavos) on public.campanhas to authenticated;
grant update (nome, canal, inicio, fim, gasto_centavos) on public.campanhas to authenticated;
alter table public.campanhas enable row level security;
create policy campanhas_select on public.campanhas for select to authenticated using (private.e_membro(agencia_id));
create policy campanhas_insert on public.campanhas for insert to authenticated with check (private.e_dono(agencia_id));
create policy campanhas_update on public.campanhas for update to authenticated using (private.e_dono(agencia_id)) with check (private.e_dono(agencia_id));
create policy campanhas_delete on public.campanhas for delete to authenticated using (private.e_dono(agencia_id));

-- R79: leads and sales per campaign key in a period (deal creation date, Brazil time). Runs as the caller, so RLS
-- keeps each agency to its own rows. Leads with a key nobody registered show up without a name; leads without any
-- key come back as one row with a null key ("not identified"), never hidden.
create function public.resultado_campanhas(p_de date, p_ate date)
returns table (chave text, campanha_id uuid, nome text, canal public.canal_campanha, inicio date, fim date,
               gasto_centavos bigint, leads bigint, vendas bigint, valor_vendido_centavos bigint)
  language sql stable security invoker set search_path = '' as $$
  with g as (
    select nullif(lower(btrim(n.utm_campanha)), '') as chave,
           count(*) as leads,
           count(*) filter (where n.etapa in ('pago', 'viajou', 'pos_venda')) as vendas,
           coalesce(sum(n.valor_centavos) filter (where n.etapa in ('pago', 'viajou', 'pos_venda')), 0)::bigint as valor
    from public.negociacoes n
    where (n.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    group by 1
  )
  select coalesce(c.utm_campanha, g.chave), c.id, c.nome, c.canal, c.inicio, c.fim, coalesce(c.gasto_centavos, 0),
         coalesce(g.leads, 0), coalesce(g.vendas, 0), coalesce(g.valor, 0)
  from public.campanhas c
  full join g on g.chave = c.utm_campanha
  order by c.inicio desc nulls last, 1 nulls last
$$;
revoke all on function public.resultado_campanhas(date, date) from public, anon;
grant execute on function public.resultado_campanhas(date, date) to authenticated;
