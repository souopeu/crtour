begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana');
insert into public.passeios (id, agencia_id, nome) values ('a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000001', '2027-03-10', 20, 100000);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_config('t.r', public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2)::text, true); -- total 200000
select set_config('t.r2', public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1)::text, true); -- total 100000

select set_config('t.p1', public.registrar_pagamento(current_setting('t.r')::uuid, 50000, 'sinal', 'pix', (now() at time zone 'America/Sao_Paulo')::date)::text, true);
select isnt(current_setting('t.p1'), '', 'registers a down payment');
select is((select pago_centavos || '/' || saldo_centavos from public.v_reservas_saldo where id = current_setting('t.r')::uuid), '50000/150000', 'the view shows paid and balance');
select throws_ok($$select public.registrar_pagamento(current_setting('t.r')::uuid, 200000, 'parcela', 'pix', (now() at time zone 'America/Sao_Paulo')::date)$$, 'CR007', null, 'a payment above the balance is refused');
select set_config('t.p2', public.registrar_pagamento(current_setting('t.r')::uuid, 150000, 'saldo', 'dinheiro', (now() at time zone 'America/Sao_Paulo')::date, 'quitou')::text, true);
select is((select saldo_centavos from public.v_reservas_saldo where id = current_setting('t.r')::uuid), 0, 'paying the exact balance settles the reservation');
select throws_ok($$select public.registrar_pagamento(current_setting('t.r')::uuid, 1, 'parcela', 'pix', (now() at time zone 'America/Sao_Paulo')::date)$$, 'CR007', null, 'nothing more can be paid once settled');
select throws_ok($$select public.registrar_pagamento(current_setting('t.r2')::uuid, 0, 'parcela', 'pix', (now() at time zone 'America/Sao_Paulo')::date)$$, '23514', null, 'a payment must be positive');
select throws_ok($$select public.registrar_pagamento(current_setting('t.r2')::uuid, 100, 'parcela', 'pix', (now() at time zone 'America/Sao_Paulo')::date + 1)$$, '22008', null, 'a payment cannot be dated in the future');
select throws_ok($$select public.registrar_pagamento(current_setting('t.r2')::uuid, 100, 'estorno', 'pix', (now() at time zone 'America/Sao_Paulo')::date)$$, '22023', null, 'refunds go through the refund function');

-- Refunds keep the history
select set_config('t.e1', public.estornar_pagamento(current_setting('t.p1')::uuid)::text, true);
select is((select tipo::text || '|' || valor_centavos || '|' || (estorno_de = current_setting('t.p1')::uuid)::text from public.pagamentos where id = current_setting('t.e1')::uuid), 'estorno|50000|true', 'a refund is a new record linked to the original');
select is((select pago_centavos || '/' || saldo_centavos from public.v_reservas_saldo where id = current_setting('t.r')::uuid), '150000/50000', 'a refund reduces the paid amount');
select is((select count(*) from public.pagamentos where reserva_id = current_setting('t.r')::uuid), 3::bigint, 'nothing is deleted: original, settlement and refund');
select throws_ok($$select public.estornar_pagamento(current_setting('t.p1')::uuid)$$, 'CR008', null, 'a payment can be refunded only once');
select throws_ok($$select public.estornar_pagamento(current_setting('t.e1')::uuid)$$, '22023', null, 'a refund cannot be refunded');

-- Due date and total
select lives_ok($$select public.definir_vencimento_saldo(current_setting('t.r')::uuid, '2027-02-01')$$, 'sets the balance due date');
select is((select vencimento_saldo::text from public.v_reservas_saldo where id = current_setting('t.r')::uuid), '2027-02-01', 'the due date is visible');
select throws_ok($$select public.alterar_valor_total(current_setting('t.r')::uuid, 100000)$$, 'CR007', null, 'the total cannot drop below what was already paid');
select lives_ok($$select public.alterar_valor_total(current_setting('t.r')::uuid, 150000)$$, 'the total can be lowered down to the paid amount (discount)');
select is((select saldo_centavos from public.v_reservas_saldo where id = current_setting('t.r')::uuid), 0, 'balance follows the new total');

-- Cancelled reservation: no new payments, but refunds still work
select lives_ok($$select public.cancelar_reserva(current_setting('t.r')::uuid)$$, 'cancels the paid reservation');
select throws_ok($$select public.registrar_pagamento(current_setting('t.r')::uuid, 100, 'parcela', 'pix', (now() at time zone 'America/Sao_Paulo')::date)$$, 'CR006', null, 'a cancelled reservation takes no new payments');
select lives_ok($$select public.estornar_pagamento(current_setting('t.p2')::uuid)$$, 'but its payments can still be refunded');

-- Tamper-proofing
select throws_ok($$insert into public.pagamentos (agencia_id, reserva_id, tipo, valor_centavos, data) values (current_setting('t.alfa')::uuid, current_setting('t.r2')::uuid, 'sinal', 1, current_date)$$, '42501', null, 'no direct insert');
select throws_ok($$update public.pagamentos set valor_centavos = 1$$, '42501', null, 'no direct update');
select throws_ok($$delete from public.pagamentos$$, '42501', null, 'no direct delete');
select throws_ok($$update public.reservas set vencimento_saldo = null, valor_total_centavos = 1$$, '42501', null, 'the total and due date cannot be edited directly');

-- Seller and other agency
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.registrar_pagamento(current_setting('t.r2')::uuid, 30000, 'sinal', 'cartao', (now() at time zone 'America/Sao_Paulo')::date)$$, 'seller registers payments too');
select is((select criado_por from public.pagamentos where valor_centavos = 30000), 'cccccccc-0000-0000-0000-000000000003'::uuid, 'the creator is stamped from the session');

reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.registrar_pagamento(current_setting('t.r2')::uuid, 100, 'parcela', 'pix', (now() at time zone 'America/Sao_Paulo')::date)$$, '42501', null, 'another agency cannot register payments');
select throws_ok($$select public.estornar_pagamento(current_setting('t.p2')::uuid)$$, '42501', null, 'another agency cannot refund');
select is((select count(*) from public.pagamentos) + (select count(*) from public.v_reservas_saldo), 0::bigint, 'another agency sees no payments or balances');

set local role anon;
select throws_ok($$select public.registrar_pagamento(current_setting('t.r2')::uuid, 100, 'parcela', 'pix', current_date)$$, '42501', null, 'anon cannot register payments');

-- Deleting the account removes payments too
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.excluir_minha_conta()$$, 'the owner can delete an account that has payments');
reset role;
select is((select count(*) from public.pagamentos where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'payments are gone with the account');

select * from finish();
rollback;
