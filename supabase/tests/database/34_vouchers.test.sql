begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana');
insert into public.passeios (id, agencia_id, nome) values ('a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000001', '2027-03-10', 20, 100000);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_config('t.paga', public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1)::text, true);
select set_config('t.aberta', public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1)::text, true);
select public.registrar_pagamento(current_setting('t.paga')::uuid, 100000, 'saldo', 'pix', (now() at time zone 'America/Sao_Paulo')::date);

-- R76: only a fully paid reservation can get a voucher
select throws_ok(format($$insert into public.vouchers (agencia_id, reserva_id, dados) values (%L, %L, '{"cliente":"Ana"}')$$, current_setting('t.alfa'), current_setting('t.aberta')),
  '42501', null, 'a reservation with a balance cannot get a voucher');
select lives_ok(format($$insert into public.vouchers (agencia_id, reserva_id, dados) values (%L, %L, '{"cliente":"Ana"}')$$, current_setting('t.alfa'), current_setting('t.paga')),
  'a fully paid reservation gets a voucher');
select ok((select codigo ~ '^[A-Za-z0-9_-]{24}$' from public.vouchers where reserva_id = current_setting('t.paga')::uuid), 'random 24-character code');
select set_config('t.cod', (select codigo from public.vouchers where reserva_id = current_setting('t.paga')::uuid), true);
select throws_ok(format($$insert into public.vouchers (agencia_id, reserva_id, dados, codigo) values (%L, %L, '{}', 'AAAAAAAAAAAAAAAAAAAAAAAA')$$, current_setting('t.alfa'), current_setting('t.paga')),
  '42501', null, 'the code cannot be chosen by hand');
select throws_ok($$update public.vouchers set dados = '{"cliente":"Outro"}'$$, '42501', null, 'the frozen values cannot be changed');
reset role;

-- Another agency: cannot see nor issue a voucher here
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.vouchers), 0::bigint, 'another agency sees no vouchers');
select throws_ok(format($$insert into public.vouchers (agencia_id, reserva_id, dados) values (%L, %L, '{}')$$, current_setting('t.alfa'), current_setting('t.paga')),
  '42501', null, 'another agency cannot issue a voucher here');
reset role;

-- Public link: only the snapshot, only while not revoked and the reservation is active
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select dados->>'cliente' from public.voucher_publico(current_setting('t.cod'))), 'Ana', 'the public link shows the voucher');
select is((select count(*) from public.voucher_publico('codigo-errado-00000000000')), 0::bigint, 'a wrong code shows nothing');
select throws_ok($$select count(*) from public.vouchers$$, '42501', null, 'visitors cannot read the vouchers table');
reset role;

update public.reservas set situacao = 'cancelada', cancelada_em = now() where id = current_setting('t.paga')::uuid;
set local role anon;
select is((select count(*) from public.voucher_publico(current_setting('t.cod'))), 0::bigint, 'a cancelled reservation voids the voucher');
reset role;
update public.reservas set situacao = 'ativa', cancelada_em = null where id = current_setting('t.paga')::uuid;
update public.vouchers set revogado_em = now() where codigo = current_setting('t.cod');
set local role anon;
select is((select count(*) from public.voucher_publico(current_setting('t.cod'))), 0::bigint, 'a revoked voucher is unavailable');
reset role;

select * from finish();
rollback;
