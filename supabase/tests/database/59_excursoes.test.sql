begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- E11-5 (R164–R165): tours of several days with a day-by-day itinerary. A owns Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000591', 'exc-a@test.dev', '{"agencia_nome":"Alfa excursões"}'),
  ('bbbbbbbb-0000-0000-0000-000000000592', 'exc-b@test.dev', '{"agencia_nome":"Beta excursões"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000591'), true);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000591","role":"authenticated"}', true);
set local role authenticated;

-- R164
select lives_ok($$insert into public.passeios (id, agencia_id, nome, tipo, dias) values
  ('a2000000-0000-0000-0000-000000000591', current_setting('t.alfa')::uuid, 'Serra gaúcha', 'excursao', 3),
  ('a2000000-0000-0000-0000-000000000592', current_setting('t.alfa')::uuid, 'Praia', 'individual', 1)$$, 'a 3-day excursion and a one-day tour');
select throws_ok($$insert into public.passeios (agencia_id, nome, tipo, dias) values (current_setting('t.alfa')::uuid, 'Curta', 'excursao', 1)$$,
  '23514', null, 'an excursion lasts 2 to 30 days');
select throws_ok($$insert into public.passeios (agencia_id, nome, tipo, dias) values (current_setting('t.alfa')::uuid, 'Longa', 'individual', 2)$$,
  '23514', null, 'a one-day tour lasts one day');
select lives_ok($$insert into public.passeio_dias (agencia_id, passeio_id, dia, titulo, descricao) values
  (current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000591', 1, 'Gramado', 'Chegada e Lago Negro'),
  (current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000591', 2, 'Canela', 'Cascata do Caracol')$$, 'the itinerary has one entry per day');
select throws_ok($$insert into public.passeio_dias (agencia_id, passeio_id, dia, titulo) values (current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000591', 2, 'De novo')$$,
  '23505', null, 'one entry per day only');

insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000591', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000591', '2030-11-07', 40, 90000),
  ('a3000000-0000-0000-0000-000000000592', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000592', '2030-11-08', 10, 10000);

-- R165: the calendar shows the excursion on every day; "em andamento" between the start and the end
select results_eq($$select dia::text, titulo from public.calendario_mes('2030-11-01', '2030-11-30') where id = 'a3000000-0000-0000-0000-000000000591' order by dia$$,
  $$values ('2030-11-07', 'Serra gaúcha'), ('2030-11-08', 'Serra gaúcha (dia 2 de 3)'), ('2030-11-09', 'Serra gaúcha (dia 3 de 3)')$$,
  'the excursion fills its three days in the calendar');
select is((select count(*) from public.calendario_mes('2030-11-01', '2030-11-30') where id = 'a3000000-0000-0000-0000-000000000592'), 1::bigint,
  'a one-day tour shows once');
select is((select count(*) from public.calendario_mes('2030-11-08', '2030-11-30') where id = 'a3000000-0000-0000-0000-000000000591'), 2::bigint,
  'a month starting mid-excursion still shows the days left');
select results_eq($$select * from public.saidas_em_andamento('2030-11-08')$$, $$values ('a3000000-0000-0000-0000-000000000591'::uuid)$$,
  'on day 2 the excursion is in progress');
select is_empty($$select * from public.saidas_em_andamento('2030-11-07') union all select * from public.saidas_em_andamento('2030-11-10')$$,
  'not on the start day nor after the end');

reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000592","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.saidas_em_andamento('2030-11-08')) + (select count(*) from public.passeio_dias), 0::bigint,
  'another agency sees neither the itinerary nor the departure');

select * from finish();
rollback;
