begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Maria');
insert into public.passeios (id, agencia_id, nome) values ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2027-03-10', 10, 100000);
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  ('a7000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 100000);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
-- R57: a member creates a pending charge, never above the balance
select throws_ok($$select public.criar_cobranca_online('a7000000-0000-0000-0000-000000000001', 100001, 'falso', 'x1', 'https://pague.exemplo/x1', null)$$, 'CR007', null, 'charge above the balance is refused');
select throws_ok($$select public.criar_cobranca_online('a7000000-0000-0000-0000-000000000001', 1000, 'falso', 'x1', 'http://inseguro/x1', null)$$, '23514', null, 'payment link must be https');
select set_config('t.c1', public.criar_cobranca_online('a7000000-0000-0000-0000-000000000001', 60000, 'falso', 'x1', 'https://pague.exemplo/x1', null)::text, true);
select is((select situacao::text || '|' || valor_centavos from public.cobrancas_online), 'pendente|60000', 'pending charge created');
-- A logged-in user can never mark it paid
select throws_ok($$select public.confirmar_cobranca_online('falso', 'x1', 60000, 'pix', now())$$, '42501', null, 'users cannot confirm payments (only the server, with the provider notice)');
select throws_ok($$update public.cobrancas_online set situacao = 'paga'$$, '42501', null, 'nor change the charge by hand');
reset role;

-- The server confirms (provider notice). Idempotent: same notice twice = one payment.
select set_config('t.p1', public.confirmar_cobranca_online('falso', 'x1', 60000, 'pix', '2026-10-15 13:00-03')::text, true);
select is((select tipo || '|' || forma || '|' || valor_centavos || '|' || data from public.pagamentos where reserva_id = 'a7000000-0000-0000-0000-000000000001'), 'sinal|pix|60000|2026-10-15', 'payment registered through the normal rules (deposit, Brazil date)');
select is(public.confirmar_cobranca_online('falso', 'x1', 60000, 'pix', '2026-10-15 13:00-03')::text, current_setting('t.p1'), 'second notice returns the same payment');
select is((select count(*) from public.pagamentos where reserva_id = 'a7000000-0000-0000-0000-000000000001'), 1::bigint, 'still one payment');
select is((select situacao::text || '|' || (pagamento_id::text = current_setting('t.p1'))::text from public.cobrancas_online where id = current_setting('t.c1')::uuid), 'paga|true', 'charge marked paid and linked to the payment');
select throws_ok($$select public.confirmar_cobranca_online('falso', 'nao-existe', 100, 'pix', now())$$, 'P0002', null, 'unknown charge');

-- Over the balance is refused even when the provider says it was paid
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_config('t.c2', public.criar_cobranca_online('a7000000-0000-0000-0000-000000000001', 40000, 'falso', 'x2', 'https://pague.exemplo/x2', null)::text, true);
select set_config('t.c3', public.criar_cobranca_online('a7000000-0000-0000-0000-000000000001', 40000, 'falso', 'x3', 'https://pague.exemplo/x3', null)::text, true);
select lives_ok(format('select public.cancelar_cobranca_online(%L)', current_setting('t.c3')), 'member cancels a pending charge');
reset role;
select throws_ok($$select public.confirmar_cobranca_online('falso', 'x2', 50000, 'cartao', now())$$, 'CR007', null, 'paid amount above the balance is refused');
select lives_ok($$select public.confirmar_cobranca_online('falso', 'x2', 40000, 'cartao', now())$$, 'exact balance confirmed');
select is((select tipo from public.pagamentos where reserva_id = 'a7000000-0000-0000-0000-000000000001' and valor_centavos = 40000), 'saldo'::public.tipo_pagamento, 'completing the total is a balance payment');
select throws_ok($$select public.confirmar_cobranca_online('falso', 'x3', 40000, 'pix', now())$$, 'CR015', null, 'a cancelled charge is not confirmed automatically');

-- Another agency sees nothing
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.cobrancas_online), 0::bigint, 'another agency sees no charges');
reset role;

select * from finish();
rollback;
