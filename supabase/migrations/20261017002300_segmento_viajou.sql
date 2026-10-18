-- E4-1: segment criterion "viajou para destino X" (R42) and editable criteria (R43).
create or replace function public.clientes_do_segmento(p jsonb)
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
    -- R42: travelled = active reservation (holder, or companion linked to the client) on a past, non-cancelled departure
    and (not p ? 'viajouPara' or exists (
      select 1 from public.reservas r
      join public.saidas s on s.id = r.saida_id
      join public.passeios ps on ps.id = s.passeio_id
      where r.situacao = 'ativa' and s.situacao <> 'cancelada' and s.data < hoje.d
        and (strpos(lower(coalesce(ps.destino, '')), lower(p->>'viajouPara')) > 0 or strpos(lower(ps.nome), lower(p->>'viajouPara')) > 0)
        and (r.cliente_id = c.id or exists (select 1 from public.passageiros pa where pa.reserva_id = r.id and pa.cliente_id = c.id))))
  order by lower(c.nome), c.id
  limit 2000
$$;

grant update (nome, mensagem, rodada, criterios) on public.segmentos to authenticated;
