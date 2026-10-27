begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- E11-4 (R162–R163): B2B rate for partner agencies, owner only. A owns Alfa, C sells in Alfa.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000581', 'b2b-a@test.dev', '{"agencia_nome":"Alfa B2B"}'),
  ('cccccccc-0000-0000-0000-000000000583', 'b2b-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000583');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000583', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000581';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000581'), true);
update public.agencias set regra_comissao = 'percentual_passeio' where id = current_setting('t.alfa')::uuid;

insert into public.passeios (id, agencia_id, nome, comissao_percentual) values ('a2000000-0000-0000-0000-000000000581', current_setting('t.alfa')::uuid, 'Praia', 10);
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000581', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000581', '2030-01-10', 20, 10000),
  ('a3000000-0000-0000-0000-000000000582', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000581', '2030-01-11', 20, 10000);
insert into public.saidas_b2b (saida_id, agencia_id, preco_centavos) values ('a3000000-0000-0000-0000-000000000581', current_setting('t.alfa')::uuid, 7000);
insert into public.clientes (id, agencia_id, nome, parceiro) values
  ('a1000000-0000-0000-0000-000000000581', current_setting('t.alfa')::uuid, 'Agência Parceira', true),
  ('a1000000-0000-0000-0000-000000000582', current_setting('t.alfa')::uuid, 'Ana Comum', false);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000581","role":"authenticated"}', true);
set local role authenticated;

-- R162
select set_config('t.b2b', public.criar_reserva('a3000000-0000-0000-0000-000000000581', 'a1000000-0000-0000-0000-000000000581', 2, null, null, null, 'b2b')::text, true);
select results_eq(format($$select valor_total_centavos, tarifa::text from public.reservas where id = %L$$, current_setting('t.b2b')),
  $$values (14000, 'b2b')$$, 'a B2B sale uses the B2B price');
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000582', 'a1000000-0000-0000-0000-000000000581', 1, null, null, null, 'b2b')$$,
  'CR027', null, 'a departure without B2B price cannot be sold B2B');
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000581', 'a1000000-0000-0000-0000-000000000582', 1, null, null, null, 'b2b')$$,
  'CR028', null, 'B2B is only for a partner');
select set_config('t.balcao', public.criar_reserva('a3000000-0000-0000-0000-000000000581', 'a1000000-0000-0000-0000-000000000582', 1)::text, true);
select results_eq(format($$select valor_total_centavos, tarifa::text from public.reservas where id = %L$$, current_setting('t.balcao')),
  $$values (10000, 'balcao')$$, 'a regular sale stays at the counter price');
select results_eq($$select criadas from public.criar_saidas_lote('a2000000-0000-0000-0000-000000000581', array['2030-02-01','2030-02-02']::date[], null, 10, 10000, null, 8000)$$,
  $$values (2)$$, 'a batch creates departures with a B2B price');
select is((select count(*) from public.saidas_b2b sb join public.saidas s on s.id = sb.saida_id where s.data in ('2030-02-01','2030-02-02') and sb.preco_centavos = 8000), 2::bigint,
  'each new departure has it');
select is((select tarifa::text from public.v_reservas_saldo where id = current_setting('t.b2b')::uuid), 'b2b', 'the balance view carries the rate');

-- R163: a B2B sale earns no seller commission
select public.registrar_pagamento(current_setting('t.b2b')::uuid, 14000, 'saldo', 'pix', '2026-10-05', null);
select public.registrar_pagamento(current_setting('t.balcao')::uuid, 10000, 'saldo', 'pix', '2026-10-05', null);
select results_eq($$select reserva_id::text from public.comissoes_do_mes('2026-10-01') where reserva_id in (current_setting('t.b2b')::uuid, current_setting('t.balcao')::uuid)$$,
  $$values (current_setting('t.balcao'))$$, 'only the counter sale has commission');

-- The seller neither sees nor uses the B2B price
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000583","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.saidas_b2b), 0::bigint, 'a seller does not see B2B prices');
select throws_ok($$insert into public.saidas_b2b (saida_id, agencia_id, preco_centavos) values ('a3000000-0000-0000-0000-000000000582', current_setting('t.alfa')::uuid, 1)$$,
  '42501', null, 'a seller cannot set one');
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000581', 'a1000000-0000-0000-0000-000000000581', 1, null, null, null, 'b2b')$$,
  '42501', null, 'a seller cannot sell B2B');
select throws_ok($$select * from public.criar_saidas_lote('a2000000-0000-0000-0000-000000000581', array['2030-03-01']::date[], null, 10, 10000, null, 8000)$$,
  '42501', null, 'a seller cannot create departures with a B2B price');
select lives_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000581', 'a1000000-0000-0000-0000-000000000582', 1)$$,
  'a seller still sells at the counter');

select * from finish();
rollback;
