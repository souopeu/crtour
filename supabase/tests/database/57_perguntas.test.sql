begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- E11-3 (R160–R161): questions before the tour and answers on the reservation. A owns Alfa, C sells in Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000571', 'pg-a@test.dev', '{"agencia_nome":"Alfa perguntas"}'),
  ('bbbbbbbb-0000-0000-0000-000000000572', 'pg-b@test.dev', '{"agencia_nome":"Beta perguntas"}'),
  ('cccccccc-0000-0000-0000-000000000573', 'pg-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000573');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000573', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000571';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000571'), true);

insert into public.passeios (id, agencia_id, nome) values
  ('a2000000-0000-0000-0000-000000000571', current_setting('t.alfa')::uuid, 'Voo livre'),
  ('a2000000-0000-0000-0000-000000000572', current_setting('t.alfa')::uuid, 'Outro');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000571', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000571', '2030-01-10', 20, 10000);
insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000571', current_setting('t.alfa')::uuid, 'Ana Perguntas');
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  ('a4000000-0000-0000-0000-000000000571', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000571', 'a1000000-0000-0000-0000-000000000571', 2, 20000);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000571","role":"authenticated"}', true);
set local role authenticated;

-- R160
select lives_ok($$insert into public.passeio_perguntas (id, agencia_id, passeio_id, texto, tipo, opcoes, obrigatoria, por_passageiro, ordem) values
  ('a6000000-0000-0000-0000-000000000571', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000571', 'Hotel para busca', 'texto', null, true, false, 1),
  ('a6000000-0000-0000-0000-000000000572', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000571', 'Peso (kg)', 'numero', null, true, true, 2),
  ('a6000000-0000-0000-0000-000000000573', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000571', 'Já voou?', 'sim_nao', null, false, true, 3),
  ('a6000000-0000-0000-0000-000000000574', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000571', 'Camiseta', 'escolha', array['P','M','G'], false, false, 4),
  ('a6000000-0000-0000-0000-000000000575', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000572', 'De outro passeio', 'texto', null, false, false, 1)$$,
  'a tour gets questions of each type');
select throws_ok($$insert into public.passeio_perguntas (agencia_id, passeio_id, texto, tipo, opcoes) values
  (current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000572', 'Só uma opção', 'escolha', array['P'])$$,
  '23514', null, 'a choice needs at least two options');
select throws_ok($$insert into public.passeio_perguntas (agencia_id, passeio_id, texto, tipo)
  select current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000572', 'P' || n, 'texto' from generate_series(1, 10) n$$,
  'CR025', null, 'a tour holds at most 10 questions');

-- R161
select lives_ok($$select public.responder_reserva('a4000000-0000-0000-0000-000000000571', '[
  {"pergunta":"a6000000-0000-0000-0000-000000000571","resposta":"Hotel Mar"},
  {"pergunta":"a6000000-0000-0000-0000-000000000572","lugar":1,"resposta":"70"},
  {"pergunta":"a6000000-0000-0000-0000-000000000572","lugar":2,"resposta":"62,5"},
  {"pergunta":"a6000000-0000-0000-0000-000000000574","resposta":"M"}]')$$, 'answers per reservation and per place');
select is((select count(*) from public.reserva_respostas where reserva_id = 'a4000000-0000-0000-0000-000000000571'), 4::bigint, 'four answers kept');
select lives_ok($$select public.responder_reserva('a4000000-0000-0000-0000-000000000571', '[{"pergunta":"a6000000-0000-0000-0000-000000000571","resposta":"Pousada Sol"}]')$$,
  'answering again');
select results_eq($$select resposta from public.reserva_respostas where pergunta_id = 'a6000000-0000-0000-0000-000000000571'$$,
  $$values ('Pousada Sol')$$, 'replaces the answer');
select throws_ok($$select public.responder_reserva('a4000000-0000-0000-0000-000000000571', '[{"pergunta":"a6000000-0000-0000-0000-000000000572","lugar":3,"resposta":"80"}]')$$,
  'CR026', null, 'a place beyond the people of the reservation is refused');
select throws_ok($$select public.responder_reserva('a4000000-0000-0000-0000-000000000571', '[{"pergunta":"a6000000-0000-0000-0000-000000000573","lugar":1,"resposta":"Talvez"}]')$$,
  'CR026', null, 'yes/no only takes Sim or Não');
select throws_ok($$select public.responder_reserva('a4000000-0000-0000-0000-000000000571', '[{"pergunta":"a6000000-0000-0000-0000-000000000574","resposta":"GG"}]')$$,
  'CR026', null, 'a choice only takes one of the options');
select throws_ok($$select public.responder_reserva('a4000000-0000-0000-0000-000000000571', '[{"pergunta":"a6000000-0000-0000-0000-000000000572","lugar":1,"resposta":"leve"}]')$$,
  'CR026', null, 'a number only takes a number');
select throws_ok($$select public.responder_reserva('a4000000-0000-0000-0000-000000000571', '[{"pergunta":"a6000000-0000-0000-0000-000000000575","resposta":"x"}]')$$,
  'CR026', null, 'a question of another tour is refused');
select lives_ok($$select public.responder_reserva('a4000000-0000-0000-0000-000000000571', '[{"pergunta":"a6000000-0000-0000-0000-000000000574","resposta":""}]')$$,
  'an empty answer clears it');

-- Deleting a question keeps the answers already given, with the question text
delete from public.passeio_perguntas where id = 'a6000000-0000-0000-0000-000000000571';
select results_eq($$select pergunta_id, pergunta_texto, resposta from public.reserva_respostas where resposta = 'Pousada Sol'$$,
  $$values (null::uuid, 'Hotel para busca', 'Pousada Sol')$$, 'the answer survives the question');

-- A seller answers too; another agency neither sees nor answers
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000573","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.responder_reserva('a4000000-0000-0000-0000-000000000571', '[{"pergunta":"a6000000-0000-0000-0000-000000000573","lugar":2,"resposta":"Não"}]')$$,
  'a seller answers');
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000572","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.responder_reserva('a4000000-0000-0000-0000-000000000571', '[]')$$,
  '42501', null, 'another agency cannot answer');

select * from finish();
rollback;
