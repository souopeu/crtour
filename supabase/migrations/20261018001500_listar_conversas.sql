-- Spec 19, R102–R103: what the inbox list shows. Runs with the caller's permissions, so RLS decides what each one sees
-- (owner: everything; seller: new ones and her own). Tabs: novos (no one handles it), meus, outros, arquivadas.
create function public.listar_conversas(p_aba text, p_busca text default null, p_etiqueta uuid default null, p_limite integer default 200)
returns table (id uuid, cliente_id uuid, cliente_nome text, cliente_whatsapp text, responsavel_id uuid, responsavel_nome text,
               situacao public.situacao_conversa, ultima_mensagem_em timestamptz, ultima_previa text,
               ultima_direcao public.direcao_whatsapp, ultima_situacao public.situacao_whatsapp, nao_lidas integer,
               etiquetas jsonb, etapa public.etapa_negociacao)
  language plpgsql stable security invoker set search_path = '' as $$
declare
  v_busca text := nullif(lower(btrim(p_busca)), '');
  v_digitos text := nullif(regexp_replace(coalesce(p_busca, ''), '\D', '', 'g'), '');
begin
  if p_aba not in ('novos', 'meus', 'outros', 'arquivadas') then raise exception 'Aba inválida' using errcode = '22023'; end if;
  return query
  select c.id, c.cliente_id, cl.nome, cl.whatsapp, c.responsavel_id, m.nome, c.situacao, c.ultima_mensagem_em, c.ultima_previa,
         u.direcao, u.situacao, c.nao_lidas,
         coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'cor', e.cor) order by e.nome)
                   from public.cliente_etiquetas ce join public.etiquetas e on e.id = ce.etiqueta_id where ce.cliente_id = c.cliente_id), '[]'::jsonb),
         (select n.etapa from public.negociacoes n where n.cliente_id = c.cliente_id and n.etapa in ('interessado', 'orcamento', 'reservado')
          order by n.criado_em desc limit 1)
  from public.conversas c
  join public.clientes cl on cl.id = c.cliente_id
  left join public.membros m on m.user_id = c.responsavel_id
  left join lateral (select mw.direcao, mw.situacao from public.mensagens_whatsapp mw where mw.cliente_id = c.cliente_id
                     order by mw.criada_em desc limit 1) u on true
  where case p_aba
          when 'novos' then c.situacao = 'aberta' and c.responsavel_id is null
          when 'meus' then c.situacao = 'aberta' and c.responsavel_id = (select auth.uid())
          when 'outros' then c.situacao = 'aberta' and c.responsavel_id <> (select auth.uid())
          else c.situacao = 'arquivada' end
    and (v_busca is null or strpos(lower(cl.nome), v_busca) > 0 or (v_digitos is not null and strpos(coalesce(cl.whatsapp, ''), v_digitos) > 0))
    and (p_etiqueta is null or exists (select 1 from public.cliente_etiquetas ce where ce.cliente_id = c.cliente_id and ce.etiqueta_id = p_etiqueta))
  order by c.ultima_mensagem_em desc
  limit least(greatest(p_limite, 1), 500);
end;
$$;

-- One row per tab: how many conversations and how many of them have unread messages.
create function public.contar_conversas()
returns table (aba text, conversas bigint, com_nao_lidas bigint)
  language sql stable security invoker set search_path = '' as $$
  select a.aba, count(c.id), count(c.id) filter (where c.nao_lidas > 0)
  from (values ('novos'), ('meus'), ('outros'), ('arquivadas')) a(aba)
  left join public.conversas c on case a.aba
      when 'novos' then c.situacao = 'aberta' and c.responsavel_id is null
      when 'meus' then c.situacao = 'aberta' and c.responsavel_id = (select auth.uid())
      when 'outros' then c.situacao = 'aberta' and c.responsavel_id <> (select auth.uid())
      else c.situacao = 'arquivada' end
  group by a.aba
$$;

revoke all on function public.listar_conversas(text, text, uuid, integer), public.contar_conversas() from public, anon;
grant execute on function public.listar_conversas(text, text, uuid, integer), public.contar_conversas() to authenticated;
