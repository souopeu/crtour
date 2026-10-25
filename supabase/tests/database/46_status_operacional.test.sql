begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- E9-1 (R136): operational status of a reservation. A owns Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000461', 'st-a@test.dev', '{"agencia_nome":"Alfa status"}'),
  ('bbbbbbbb-0000-0000-0000-000000000462', 'st-b@test.dev', '{"agencia_nome":"Beta status"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000461'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000461', current_setting('t.alfa')::uuid, 'Ana Status');
insert into public.passeios (id, agencia_id, nome) values ('a2000000-0000-0000-0000-000000000461', current_setting('t.alfa')::uuid, 'Praia status');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000461', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000461', '2027-05-10', 10, 10000);
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  ('a4000000-0000-0000-0000-000000000461', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000461', 'a1000000-0000-0000-0000-000000000461', 2, 20000),
  ('a4000000-0000-0000-0000-000000000462', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000461', 'a1000000-0000-0000-0000-000000000461', 1, 10000);

select is((select status_operacional::text from public.reservas where id = 'a4000000-0000-0000-0000-000000000461'), 'a_definir', 'a new reservation starts as "a definir"');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000461","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.definir_status_operacional('a4000000-0000-0000-0000-000000000461', 'a_comunicar')$$, 'a member moves forward, skipping steps');
select is((select status_operacional::text from public.v_reservas_saldo where id = 'a4000000-0000-0000-0000-000000000461'), 'a_comunicar', 'the balance view carries the status');
select isnt((select status_operacional_em from public.reservas where id = 'a4000000-0000-0000-0000-000000000461'), null, 'the change time is kept');
select throws_ok($$select public.definir_status_operacional('a4000000-0000-0000-0000-000000000461', 'em_organizacao')$$, 'CR018', null, 'going back needs confirmation');
select lives_ok($$select public.definir_status_operacional('a4000000-0000-0000-0000-000000000461', 'em_organizacao', true)$$, 'going back with confirmation works');
select is((select status_operacional::text from public.reservas where id = 'a4000000-0000-0000-0000-000000000461'), 'em_organizacao', 'the status went back');
select lives_ok($$select public.definir_status_operacional('a4000000-0000-0000-0000-000000000461', 'em_organizacao')$$, 'the same status again is a no-op');
select throws_ok($$update public.reservas set status_operacional = 'pronta' where id = 'a4000000-0000-0000-0000-000000000461'$$, '42501', null, 'no direct update of the column');

select public.cancelar_reserva('a4000000-0000-0000-0000-000000000462');
select throws_ok($$select public.definir_status_operacional('a4000000-0000-0000-0000-000000000462', 'pronta')$$, 'CR006', null, 'a cancelled reservation keeps its status');

-- Calendar: the departure says how many reservations still need organising (not "pronta" nor "em execução").
select is((select detalhe from public.calendario_mes('2027-05-01', '2027-05-31') where tipo = 'saida'), '2/10 · 1 a organizar', 'the departure counts what is left to organise');
select public.definir_status_operacional('a4000000-0000-0000-0000-000000000461', 'pronta');
select is((select detalhe from public.calendario_mes('2027-05-01', '2027-05-31') where tipo = 'saida'), '2/10', 'nothing left to organise: just the seats');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000462","role":"authenticated"}', true);
select throws_ok($$select public.definir_status_operacional('a4000000-0000-0000-0000-000000000461', 'em_execucao')$$, '42501', null, 'another agency cannot touch it');

select * from finish();
rollback;
