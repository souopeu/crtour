begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- E9-3 (R140): move a reservation to another departure of the same tour. A owns Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000481', 'mov-a@test.dev', '{"agencia_nome":"Alfa mover"}'),
  ('bbbbbbbb-0000-0000-0000-000000000482', 'mov-b@test.dev', '{"agencia_nome":"Beta mover"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000481'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000481', current_setting('t.alfa')::uuid, 'Ana Mover');
insert into public.passeios (id, agencia_id, nome) values
  ('a2000000-0000-0000-0000-000000000481', current_setting('t.alfa')::uuid, 'Praia'),
  ('a2000000-0000-0000-0000-000000000482', current_setting('t.alfa')::uuid, 'Serra');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos, situacao) values
  ('a3000000-0000-0000-0000-000000000481', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000481', '2027-07-01', 10, 10000, 'aberta'),
  ('a3000000-0000-0000-0000-000000000482', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000481', '2027-07-08', 3, 10000, 'aberta'),
  ('a3000000-0000-0000-0000-000000000483', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000481', '2027-07-15', 10, 10000, 'encerrada'),
  ('a3000000-0000-0000-0000-000000000484', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000482', '2027-07-01', 10, 10000, 'aberta');
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  ('a4000000-0000-0000-0000-000000000481', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000481', 'a1000000-0000-0000-0000-000000000481', 2, 20000),
  ('a4000000-0000-0000-0000-000000000482', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000481', 'a1000000-0000-0000-0000-000000000481', 2, 20000),
  ('a4000000-0000-0000-0000-000000000483', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000481', 'a1000000-0000-0000-0000-000000000481', 1, 10000);
insert into public.pagamentos (agencia_id, reserva_id, valor_centavos, tipo, forma, data) values
  (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000481', 5000, 'sinal', 'pix', '2026-10-20');
insert into public.negociacoes (id, agencia_id, cliente_id, titulo, saida_id) values
  ('a6000000-0000-0000-0000-000000000481', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000481', 'Praia julho', 'a3000000-0000-0000-0000-000000000481');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000481","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.mover_reserva_saida('a4000000-0000-0000-0000-000000000481', 'a3000000-0000-0000-0000-000000000482')$$, 'moves to another departure of the same tour');
select is((select saida_id::text from public.reservas where id = 'a4000000-0000-0000-0000-000000000481'), 'a3000000-0000-0000-0000-000000000482', 'the reservation is in the new departure');
select is((select pago_centavos from public.v_reservas_saldo where id = 'a4000000-0000-0000-0000-000000000481'), 5000, 'payments follow the reservation');
select is((select saida_id::text from public.negociacoes where id = 'a6000000-0000-0000-0000-000000000481'), 'a3000000-0000-0000-0000-000000000482', 'the client''s deal on the old departure follows too');
select is((select livres from public.v_saidas_vagas where id = 'a3000000-0000-0000-0000-000000000481'), 7, 'the old departure gets the seats back');

select throws_ok($$select public.mover_reserva_saida('a4000000-0000-0000-0000-000000000482', 'a3000000-0000-0000-0000-000000000482')$$, 'CR001', null, 'no room for 2 more in a 3-seat departure with 2 sold');
select lives_ok($$select public.mover_reserva_saida('a4000000-0000-0000-0000-000000000483', 'a3000000-0000-0000-0000-000000000482')$$, 'one more person still fits');
select throws_ok($$select public.mover_reserva_saida('a4000000-0000-0000-0000-000000000482', 'a3000000-0000-0000-0000-000000000483')$$, 'CR002', null, 'a closed departure takes no one');
select throws_ok($$select public.mover_reserva_saida('a4000000-0000-0000-0000-000000000482', 'a3000000-0000-0000-0000-000000000484')$$, 'CR014', null, 'only to a departure of the same tour');
select lives_ok($$select public.mover_reserva_saida('a4000000-0000-0000-0000-000000000482', 'a3000000-0000-0000-0000-000000000481')$$, 'moving to where it already is changes nothing');

select public.cancelar_reserva('a4000000-0000-0000-0000-000000000482');
select throws_ok($$select public.mover_reserva_saida('a4000000-0000-0000-0000-000000000482', 'a3000000-0000-0000-0000-000000000482')$$, 'CR006', null, 'a cancelled reservation does not move');
select throws_ok($$update public.reservas set saida_id = 'a3000000-0000-0000-0000-000000000481' where id = 'a4000000-0000-0000-0000-000000000481'$$, '42501', null, 'no direct update of the departure');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000482","role":"authenticated"}', true);
select throws_ok($$select public.mover_reserva_saida('a4000000-0000-0000-0000-000000000481', 'a3000000-0000-0000-0000-000000000481')$$, '42501', null, 'another agency cannot move it');

select * from finish();
rollback;
