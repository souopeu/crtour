begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- E9-4 (R141): boarding. Each person travelling is one slot: the responsible client (no companion, vaga 0),
-- each named companion, and each place still without a name (vaga 1, 2…). A owns Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000491', 'emb-a@test.dev', '{"agencia_nome":"Alfa embarque"}'),
  ('bbbbbbbb-0000-0000-0000-000000000492', 'emb-b@test.dev', '{"agencia_nome":"Beta embarque"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000491'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000491', current_setting('t.alfa')::uuid, 'Ana Embarque');
insert into public.passeios (id, agencia_id, nome) values ('a2000000-0000-0000-0000-000000000491', current_setting('t.alfa')::uuid, 'Ilha');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000491', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000491', '2027-09-01', 10, 10000);
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, status_operacional) values
  ('a4000000-0000-0000-0000-000000000491', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000491', 'a1000000-0000-0000-0000-000000000491', 3, 30000, 'pronta'),
  ('a4000000-0000-0000-0000-000000000492', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000491', 'a1000000-0000-0000-0000-000000000491', 1, 10000, 'a_comunicar');
insert into public.passageiros (id, agencia_id, reserva_id, nome) values
  ('a5000000-0000-0000-0000-000000000491', current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000491', 'Beto Acompanhante');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000491","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$select public.marcar_embarque('a4000000-0000-0000-0000-000000000491', null, 0, true)$$, 'CR021', null, 'nobody boards before the boarding starts');
select lives_ok($$select public.iniciar_embarque('a3000000-0000-0000-0000-000000000491')$$, 'a member starts the boarding');
select isnt((select embarque_iniciado_em from public.saidas where id = 'a3000000-0000-0000-0000-000000000491'), null, 'the start time is kept');
select is((select status_operacional::text from public.reservas where id = 'a4000000-0000-0000-0000-000000000491'), 'em_execucao', 'ready reservations go to "em execução"');
select is((select status_operacional::text from public.reservas where id = 'a4000000-0000-0000-0000-000000000492'), 'a_comunicar', 'the others keep their status');

select lives_ok($$select public.marcar_embarque('a4000000-0000-0000-0000-000000000491', null, 0, true)$$, 'the responsible client boards');
select lives_ok($$select public.marcar_embarque('a4000000-0000-0000-0000-000000000491', 'a5000000-0000-0000-0000-000000000491', 0, true)$$, 'a named companion boards');
select lives_ok($$select public.marcar_embarque('a4000000-0000-0000-0000-000000000491', null, 1, true)$$, 'the place without a name boards');
select lives_ok($$select public.marcar_embarque('a4000000-0000-0000-0000-000000000491', null, 1, true)$$, 'marking twice changes nothing');
select is((select count(*) from public.embarques where reserva_id = 'a4000000-0000-0000-0000-000000000491'), 3::bigint, 'three people of three on board');
select is((select marcado_por::text from public.embarques where reserva_id = 'a4000000-0000-0000-0000-000000000491' and vaga = 0 and passageiro_id is null), 'aaaaaaaa-0000-0000-0000-000000000491', 'who marked is kept');
select throws_ok($$select public.marcar_embarque('a4000000-0000-0000-0000-000000000491', null, 2, true)$$, '22023', null, 'a 3-person reservation has only one unnamed place (vaga 1)');
select lives_ok($$select public.marcar_embarque('a4000000-0000-0000-0000-000000000491', null, 1, false)$$, 'unmarking works');
select throws_ok($$insert into public.embarques (agencia_id, reserva_id) values (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000492')$$, '42501', null, 'only through the functions');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000492","role":"authenticated"}', true);
select is((select count(*) from public.embarques), 0::bigint, 'another agency sees no boarding');

select * from finish();
rollback;
