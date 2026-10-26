begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- E10-3 (R151): daily check. A owns Alfa, C sells in Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000531', 'cf-a@test.dev', '{"agencia_nome":"Alfa conferência"}'),
  ('bbbbbbbb-0000-0000-0000-000000000532', 'cf-b@test.dev', '{"agencia_nome":"Beta conferência"}'),
  ('cccccccc-0000-0000-0000-000000000533', 'cf-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000533');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000533', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000531';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000531'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000531', current_setting('t.alfa')::uuid, 'Ana Conferência');
insert into public.passeios (id, agencia_id, nome) values ('a2000000-0000-0000-0000-000000000531', current_setting('t.alfa')::uuid, 'Praia');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000531', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000531', '2027-01-10', 10, 10000);
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  ('a4000000-0000-0000-0000-000000000531', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000531', 'a1000000-0000-0000-0000-000000000531', 2, 20000);
insert into public.pagamentos (id, agencia_id, reserva_id, valor_centavos, tipo, forma, data) values
  ('a5000000-0000-0000-0000-000000000531', current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000531', 5000, 'sinal', 'pix', '2026-10-20');
insert into public.contas_pagar (id, agencia_id, descricao, valor_centavos, vencimento) values
  ('a9000000-0000-0000-0000-000000000531', current_setting('t.alfa')::uuid, 'Luz', 3000, '2026-10-25');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000531","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.conferir_dia('2026-10-20', 'Caixa batido')$$, 'the owner checks a day');
select is((select observacao from public.conferencias_dia where dia = '2026-10-20'), 'Caixa batido', 'with a note');
select is((select conferido_por::text from public.conferencias_dia where dia = '2026-10-20'), 'aaaaaaaa-0000-0000-0000-000000000531', 'and who checked');

-- A change on that day undoes the check (and says when); a change on another day does not
update public.contas_pagar set pago_em = '2026-10-21', forma_pago = 'dinheiro' where id = 'a9000000-0000-0000-0000-000000000531';
select is((select invalidada_em from public.conferencias_dia where dia = '2026-10-20'), null, 'a payment on another day keeps the check');
reset role;
insert into public.pagamentos (agencia_id, reserva_id, valor_centavos, tipo, forma, data, estorno_de) values
  (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000531', 5000, 'estorno', 'pix', '2026-10-20', 'a5000000-0000-0000-0000-000000000531');
set local role authenticated;
select isnt((select invalidada_em from public.conferencias_dia where dia = '2026-10-20'), null, 'a refund on the checked day undoes the check');

select lives_ok($$select public.conferir_dia('2026-10-20', 'Conferido de novo')$$, 'checking again');
select is((select invalidada_em from public.conferencias_dia where dia = '2026-10-20'), null, 'clears the warning');
select lives_ok($$select public.conferir_dia('2026-10-21', null)$$, 'another day');
update public.contas_pagar set pago_em = null, forma_pago = null where id = 'a9000000-0000-0000-0000-000000000531';
select isnt((select invalidada_em from public.conferencias_dia where dia = '2026-10-21'), null, 'undoing a payment of a checked day undoes the check (old date counts)');
select throws_ok($$select public.conferir_dia(current_date + 2, null)$$, '22008', null, 'a future day cannot be checked');

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000533","role":"authenticated"}', true);
select throws_ok($$select public.conferir_dia('2026-10-22', null)$$, '42501', null, 'only the owner checks');

select * from finish();
rollback;
