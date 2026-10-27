begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- E11-1 (R155–R156): departures in batch and price/capacity in batch. A owns Alfa, C sells in Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000551', 'sl-a@test.dev', '{"agencia_nome":"Alfa lote"}'),
  ('bbbbbbbb-0000-0000-0000-000000000552', 'sl-b@test.dev', '{"agencia_nome":"Beta lote"}'),
  ('cccccccc-0000-0000-0000-000000000553', 'sl-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000553');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000553', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000551';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000551'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000552'), true);

insert into public.passeios (id, agencia_id, nome) values
  ('a2000000-0000-0000-0000-000000000551', current_setting('t.alfa')::uuid, 'Praia'),
  ('a2000000-0000-0000-0000-000000000552', current_setting('t.alfa')::uuid, 'Velho');
update public.passeios set arquivado = true where id = 'a2000000-0000-0000-0000-000000000552';
insert into public.passeios (id, agencia_id, nome) values ('b2000000-0000-0000-0000-000000000551', current_setting('t.beta')::uuid, 'Serra');
insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000551', current_setting('t.alfa')::uuid, 'Ana Lote');
-- one departure already there (no time) and one in the past
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000551', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000551', '2030-01-07', 10, 10000),
  ('a3000000-0000-0000-0000-000000000552', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000551', '2020-01-07', 10, 10000);
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('b3000000-0000-0000-0000-000000000551', current_setting('t.beta')::uuid, 'b2000000-0000-0000-0000-000000000551', '2030-01-07', 10, 10000);
insert into public.reservas (agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  (current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000551', 'a1000000-0000-0000-0000-000000000551', 4, 40000);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000551","role":"authenticated"}', true);
set local role authenticated;

-- R155
select results_eq(
  $$select criadas, puladas from public.criar_saidas_lote('a2000000-0000-0000-0000-000000000551', array['2030-01-08','2030-01-09','2030-01-10']::date[], array['08:00','14:00']::time[], 12, 9000)$$,
  $$values (6, 0)$$, 'three dates at two times create six departures');
select is((select count(*) from public.saidas where passeio_id = 'a2000000-0000-0000-0000-000000000551' and data = '2030-01-08' and preco_centavos = 9000 and capacidade = 12), 2::bigint,
  'with the price and capacity given');
select results_eq(
  $$select criadas, puladas from public.criar_saidas_lote('a2000000-0000-0000-0000-000000000551', array['2030-01-08','2030-01-11']::date[], array['08:00','14:00']::time[], 12, 9000)$$,
  $$values (2, 2)$$, 'a date and time that already has a departure is skipped');
select results_eq(
  $$select criadas, puladas from public.criar_saidas_lote('a2000000-0000-0000-0000-000000000551', array['2030-01-07','2030-01-12']::date[], null, 12, 9000)$$,
  $$values (1, 1)$$, 'without a time, a date that already has a departure without time is skipped');
select throws_ok($$select * from public.criar_saidas_lote('b2000000-0000-0000-0000-000000000551', array['2030-02-01']::date[], null, 12, 9000)$$,
  '42501', null, 'another agency''s tour is refused');
select throws_ok($$select * from public.criar_saidas_lote('a2000000-0000-0000-0000-000000000552', array['2030-02-01']::date[], null, 12, 9000)$$,
  'CR022', null, 'an archived tour gets no departures');
select throws_ok($$select * from public.criar_saidas_lote('a2000000-0000-0000-0000-000000000551',
    (select array_agg(d::date) from generate_series('2031-01-01'::date, '2031-12-31'::date, '1 day') d), array['08:00','14:00']::time[], 12, 9000)$$,
  '22023', null, 'more than 500 departures in one batch is refused');

-- R156
select is_empty(
  $$select * from public.alterar_saidas_lote(array['a3000000-0000-0000-0000-000000000551']::uuid[], 12000, null)$$,
  'the price of a future departure changes');
select is((select valor_total_centavos from public.reservas where saida_id = 'a3000000-0000-0000-0000-000000000551'), 40000,
  'reservations already made keep their value');
select results_eq(
  $$select motivo from public.alterar_saidas_lote(array['a3000000-0000-0000-0000-000000000551', 'a3000000-0000-0000-0000-000000000552', 'b3000000-0000-0000-0000-000000000551']::uuid[], null, 3) order by motivo$$,
  $$values ('42501'), ('CR003'), ('passada')$$, 'below the seats sold, past and other agency''s departures are left out, each with its reason');
select is((select capacidade from public.saidas where id = 'b3000000-0000-0000-0000-000000000551'), null::int, 'another agency''s departure is not even visible');
select throws_ok($$select * from public.alterar_saidas_lote(array['a3000000-0000-0000-0000-000000000551']::uuid[], null, null)$$,
  '22023', null, 'nothing to change is refused');

-- A seller also creates departures (as with one departure)
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000553","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select criadas, puladas from public.criar_saidas_lote('a2000000-0000-0000-0000-000000000551', array['2030-03-01']::date[], null, 12, 9000)$$,
  $$values (1, 0)$$, 'a seller creates departures in batch');
select is((select capacidade from public.saidas where id = 'a3000000-0000-0000-0000-000000000551'), 10, 'the departure below the seats sold kept its capacity');

select * from finish();
rollback;
