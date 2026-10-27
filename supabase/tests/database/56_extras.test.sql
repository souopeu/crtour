begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- E11-2 (R157–R159): extras sold with a reservation. A owns Alfa, C sells in Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000561', 'ex-a@test.dev', '{"agencia_nome":"Alfa extras"}'),
  ('bbbbbbbb-0000-0000-0000-000000000562', 'ex-b@test.dev', '{"agencia_nome":"Beta extras"}'),
  ('cccccccc-0000-0000-0000-000000000563', 'ex-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000563');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000563', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000561';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000561'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000562'), true);
update public.agencias set regra_comissao = 'percentual_passeio' where id = current_setting('t.alfa')::uuid;

insert into public.passeios (id, agencia_id, nome, comissao_percentual) values
  ('a2000000-0000-0000-0000-000000000561', current_setting('t.alfa')::uuid, 'Praia', 10),
  ('a2000000-0000-0000-0000-000000000562', current_setting('t.alfa')::uuid, 'Serra', 0);
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000561', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000561', '2030-01-10', 20, 10000);
insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000561', current_setting('t.alfa')::uuid, 'Ana Extras');
insert into public.extras (id, agencia_id, nome, preco_centavos, custo_centavos, cobranca, todos_passeios, ativo) values
  ('a5000000-0000-0000-0000-000000000561', current_setting('t.alfa')::uuid, 'Almoço', 4000, 2500, 'por_pessoa', true, true),
  ('a5000000-0000-0000-0000-000000000562', current_setting('t.alfa')::uuid, 'Fotos', 1500, null, 'por_reserva', true, true),
  ('a5000000-0000-0000-0000-000000000563', current_setting('t.alfa')::uuid, 'Kit serra', 900, null, 'por_pessoa', false, true),
  ('a5000000-0000-0000-0000-000000000564', current_setting('t.alfa')::uuid, 'Antigo', 900, null, 'por_pessoa', true, false);
insert into public.extras_passeios (extra_id, passeio_id, agencia_id) values
  ('a5000000-0000-0000-0000-000000000563', 'a2000000-0000-0000-0000-000000000562', current_setting('t.alfa')::uuid);
insert into public.extras (id, agencia_id, nome, preco_centavos, cobranca) values
  ('b5000000-0000-0000-0000-000000000561', current_setting('t.beta')::uuid, 'De outra', 100, 'por_reserva');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000561","role":"authenticated"}', true);
set local role authenticated;

-- R158: 2 people × 100,00 + 2 lunches × 40,00 + photos 15,00
select set_config('t.r1', public.criar_reserva('a3000000-0000-0000-0000-000000000561', 'a1000000-0000-0000-0000-000000000561', 2, null, null,
  '[{"extra":"a5000000-0000-0000-0000-000000000561","quantidade":2},{"extra":"a5000000-0000-0000-0000-000000000562","quantidade":1}]')::text, true);
select is((select valor_total_centavos from public.reservas where id = current_setting('t.r1')::uuid), 29500, 'the total adds the extras');
select is((select valor_extras_centavos from public.reservas where id = current_setting('t.r1')::uuid), 9500, 'and keeps the extras part apart');
update public.extras set preco_centavos = 9999 where id = 'a5000000-0000-0000-0000-000000000561';
select is((select preco_centavos from public.reserva_itens where reserva_id = current_setting('t.r1')::uuid and nome = 'Almoço'), 4000,
  'a later price change does not touch the reservation');
select is((select custo_centavos from public.reserva_itens where reserva_id = current_setting('t.r1')::uuid and nome = 'Almoço'), 2500,
  'the cost of the moment is kept too');

select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000561', 'a1000000-0000-0000-0000-000000000561', 1, null, null, '[{"extra":"a5000000-0000-0000-0000-000000000563","quantidade":1}]')$$,
  'CR023', null, 'an extra of another tour is refused');
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000561', 'a1000000-0000-0000-0000-000000000561', 1, null, null, '[{"extra":"a5000000-0000-0000-0000-000000000564","quantidade":1}]')$$,
  'CR023', null, 'an inactive extra is refused');
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000561', 'a1000000-0000-0000-0000-000000000561', 1, null, null, '[{"extra":"b5000000-0000-0000-0000-000000000561","quantidade":1}]')$$,
  'CR023', null, 'another agency''s extra is refused');
select lives_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000561', 'a1000000-0000-0000-0000-000000000561', 1, null, 'sem extras')$$,
  'a reservation without extras works as before (import, one-off service)');

-- Adding and removing after the sale
select lives_ok(format($$select public.adicionar_item_reserva(%L, 'a5000000-0000-0000-0000-000000000562', 2)$$, current_setting('t.r1')),
  'an extra is added later');
select is((select valor_total_centavos from public.reservas where id = current_setting('t.r1')::uuid), 32500, 'and the total goes up');
select lives_ok(format($$select public.remover_item_reserva((select id from public.reserva_itens where reserva_id = %L and quantidade = 2 and nome = 'Fotos'))$$, current_setting('t.r1')),
  'an extra is removed');
select results_eq(format($$select valor_total_centavos, valor_extras_centavos from public.reservas where id = %L$$, current_setting('t.r1')),
  $$values (29500, 9500)$$, 'and the total goes back down');
select throws_ok(format($$select public.alterar_valor_total(%L, 9000)$$, current_setting('t.r1')),
  'CR024', null, 'the total cannot go below the extras');

-- R159: commission is on the tour only (10 % of 200,00), the reservation is paid in full
select public.registrar_pagamento(current_setting('t.r1')::uuid, 29500, 'saldo', 'pix', '2026-10-05', null);
select is((select comissao_centavos from public.comissoes_do_mes('2026-10-01') where reserva_id = current_setting('t.r1')::uuid), 2000,
  'the commission leaves the extras out');
select throws_ok(format($$select public.remover_item_reserva((select id from public.reserva_itens where reserva_id = %L and nome = 'Fotos'))$$, current_setting('t.r1')),
  'CR007', null, 'removing an extra cannot leave the total below what was paid');

-- Another agency sees none of it
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000562","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.reserva_itens) + (select count(*) from public.extras where agencia_id = current_setting('t.alfa')::uuid), 0::bigint,
  'another agency sees no extras nor items');

select * from finish();
rollback;
