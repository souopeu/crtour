-- The balance view also carries the note and creation time, so lists need a single query.
create or replace view public.v_reservas_saldo with (security_invoker = true) as
select r.id, r.agencia_id, r.saida_id, r.cliente_id, r.qtd_pessoas, r.valor_total_centavos, r.situacao, r.vencimento_saldo,
       coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0)::int as pago_centavos,
       (r.valor_total_centavos
        - coalesce(sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end), 0))::int as saldo_centavos,
       r.observacao, r.criada_em
from public.reservas r
left join public.pagamentos p on p.reserva_id = r.id
group by r.id;
