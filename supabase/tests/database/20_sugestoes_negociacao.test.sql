begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Maria');
insert into public.passeios (id, agencia_id, nome) values ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', current_date + 30, 10, 100000);
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  ('a7000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 100000);
insert into public.negociacoes (id, agencia_id, cliente_id, titulo) values
  ('a4000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Lisboa');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.sugestoes_dispensadas (agencia_id, negociacao_id, reserva_id, para) values (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'reservado')$$, '"Agora não" is recorded');
select is((select dispensada_por from public.sugestoes_dispensadas), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'who dismissed it is stamped');
select throws_ok($$insert into public.sugestoes_dispensadas (agencia_id, negociacao_id, reserva_id, para) values (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'reservado')$$, '23505', null, 'once per deal, reservation and target stage');
select throws_ok($$insert into public.sugestoes_dispensadas (agencia_id, negociacao_id, reserva_id, para) values (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'perdido')$$, '23514', null, 'only Reservado or Pago are suggested');
select throws_ok($$insert into public.sugestoes_dispensadas (agencia_id, negociacao_id, reserva_id, para) values (current_setting('t.beta')::uuid, 'a4000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'pago')$$, '42501', null, 'not in another agency');
reset role;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.sugestoes_dispensadas), 0::bigint, 'another agency sees nothing');
reset role;

-- The account deletion still works with dismissals around
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.excluir_minha_conta()$$, 'deleting the account removes dismissals too');

select * from finish();
rollback;
