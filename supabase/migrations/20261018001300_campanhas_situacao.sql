-- R96: each lead of a campaign is sold, lost or still open, so the screen can draw a split bar.
-- Sold = a won deal created from the arrival on (unchanged). Lost = no sale, a lost deal from the arrival on and no
-- deal still open. Open = the rest (an open deal, or no deal yet). The three parts always add up to the leads.
drop function public.resultado_campanhas(date, date);
create function public.resultado_campanhas(p_de date, p_ate date)
returns table (chave text, canal text, titulo text, campanha_id uuid, nome text, inicio date, fim date,
               gasto_centavos bigint, leads bigint, vendas bigint, valor_vendido_centavos bigint, perdidos bigint, em_aberto bigint)
  language sql stable security invoker set search_path = '' as $$
  with o as (
    select v.chave, v.cliente_id, min(v.criado_em) as em,
           (array_agg(v.canal::text order by v.criado_em))[1] as canal,
           (array_agg(v.anuncio_titulo order by v.criado_em) filter (where v.anuncio_titulo is not null))[1] as titulo
    from public.v_origens_cliente v
    where (v.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    group by v.chave, v.cliente_id
  ), s as (
    select o.chave, o.cliente_id, o.canal, o.titulo,
           count(n.id) filter (where n.etapa in ('pago', 'viajou', 'pos_venda')) as vendas,
           coalesce(sum(n.valor_centavos) filter (where n.etapa in ('pago', 'viajou', 'pos_venda')), 0) as valor,
           bool_or(n.etapa = 'perdido') is true and not (bool_or(n.etapa in ('interessado', 'orcamento', 'reservado')) is true) as perdeu
    from o
    left join public.negociacoes n on n.cliente_id = o.cliente_id and n.criado_em >= o.em - interval '1 day'
    group by o.chave, o.cliente_id, o.canal, o.titulo
  ), g as (
    select s.chave, min(s.canal) as canal, max(s.titulo) as titulo, count(*) as leads,
           count(*) filter (where s.vendas > 0) as vendas, sum(s.valor)::bigint as valor,
           count(*) filter (where s.vendas = 0 and s.perdeu) as perdidos
    from s group by s.chave
  ), sc as (
    select bool_or(n.etapa in ('pago', 'viajou', 'pos_venda')) is true as vendeu,
           coalesce(sum(n.valor_centavos) filter (where n.etapa in ('pago', 'viajou', 'pos_venda')), 0) as valor,
           bool_or(n.etapa = 'perdido') is true and not (bool_or(n.etapa in ('interessado', 'orcamento', 'reservado')) is true) as perdeu
    from public.clientes c
    left join public.negociacoes n on n.cliente_id = c.id
    where (c.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
      and not exists (select 1 from public.v_origens_cliente v where v.cliente_id = c.id)
    group by c.id
  ), sem as (
    select count(*) as leads, count(*) filter (where vendeu) as vendas, coalesce(sum(valor), 0)::bigint as valor,
           count(*) filter (where not vendeu and perdeu) as perdidos
    from sc
  )
  select * from (
    select coalesce(c.utm_campanha, g.chave), coalesce(g.canal, c.canal::text), g.titulo, c.id, c.nome, c.inicio, c.fim,
           coalesce(c.gasto_centavos, 0), coalesce(g.leads, 0), coalesce(g.vendas, 0), coalesce(g.valor, 0),
           coalesce(g.perdidos, 0), coalesce(g.leads - g.vendas - g.perdidos, 0)
    from public.campanhas c
    full join g on g.chave = c.utm_campanha
    order by coalesce(g.leads, 0) desc, 1
  ) r
  union all
  select null, null, null, null, null, null, null, 0, sem.leads, sem.vendas, sem.valor, sem.perdidos, sem.leads - sem.vendas - sem.perdidos
  from sem where sem.leads > 0
$$;
revoke all on function public.resultado_campanhas(date, date) from public, anon;
grant execute on function public.resultado_campanhas(date, date) to authenticated;
