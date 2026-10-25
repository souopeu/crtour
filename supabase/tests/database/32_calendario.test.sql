begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Users: A (owner, Alfa), B (owner, Beta), C (seller, Alfa)
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias
  where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome, aniversario) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana Souza', '1990-11-05'),
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Beto Lima', '1985-12-01'),
  ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Lia Bissexta', '2000-02-29'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Bia Beta',  '1991-11-05');
insert into public.passeios (id, agencia_id, nome) values
  ('a4000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Gramado'),
  ('b4000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Beta tour');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos, situacao) values
  ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', '2030-11-10', 3, 100000, 'aberta'),
  ('a5000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', '2030-11-20', 5, 100000, 'cancelada'),
  ('a5000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', '2030-12-15', 5, 100000, 'aberta'),
  ('b5000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b4000000-0000-0000-0000-000000000001', '2030-11-10', 5, 100000, 'aberta');

-- Reservations: Ana (sold by the seller, balance due 12/11), Beto (sold by the owner, due 13/11),
-- a cancelled one with a balance, and a fully paid one. Created directly; the tour is in the future.
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, situacao, vencimento_saldo, vendedor_id) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2, 200000, 'ativa', '2030-11-12', 'cccccccc-0000-0000-0000-000000000003'),
  ('a6000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 1, 100000, 'ativa', '2030-11-13', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a6000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 1, 100000, 'cancelada', '2030-11-14', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a6000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 1, 100000, 'ativa', '2030-11-15', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.pagamentos (agencia_id, reserva_id, valor_centavos, tipo, data) values
  (current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 50000, 'sinal', '2030-10-01'),
  (current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000004', 100000, 'sinal', '2030-10-01');

insert into public.custos_saida (agencia_id, saida_id, descricao, valor_centavos, vencimento, pago_em) values
  (current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', 'Ônibus', 80000, '2030-11-08', null),
  (current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', 'Guia',   30000, '2030-11-09', '2030-11-01');

-- security_invoker: the view must run as each test user, not as its owner
create temp view cal with (security_invoker = true) as select * from public.calendario_mes('2030-10-28', '2030-12-08');
grant select on cal to authenticated;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select detalhe from cal where tipo = 'saida' and dia = '2030-11-10'), '3/3 · 2 a organizar', 'departure shows booked/capacity and, since R136, what is left to organise');
select is((select situacao from cal where tipo = 'saida' and dia = '2030-11-10'), 'lotada', 'open departure with no seats left is "lotada"');
select is((select situacao from cal where tipo = 'saida' and dia = '2030-11-20'), 'cancelada', 'cancelled departure stays, marked as such');
select is((select count(*) from cal where tipo = 'saida' and dia = '2030-12-15'), 0::bigint, 'only days inside the range');
select is((select valor_centavos from cal where tipo = 'saldo' and dia = '2030-11-12'), 150000, 'balance due = total minus paid');
select is((select titulo from cal where tipo = 'saldo' and dia = '2030-11-12'), 'Ana Souza', 'balance shows the client');
select is((select count(*) from cal where tipo = 'saldo' and dia in ('2030-11-14', '2030-11-15')), 0::bigint, 'cancelled and fully paid reservations are left out');
select is((select array_agg(titulo order by dia) from cal where tipo = 'aniversario'), array['Ana Souza', 'Beto Lima'], 'birthdays by month and day, own agency only');
select is((select titulo from cal where tipo = 'custo'), 'Ônibus', 'owner sees unpaid costs only');
select is((select count(*) from cal where dia = '2030-11-10' and titulo = 'Beta tour'), 0::bigint, 'never shows other agencies');
select is((select dia from public.calendario_mes('2031-02-20', '2031-03-05') where titulo = 'Lia Bissexta'), '2031-02-28'::date, '29/02 birthday shows on 28/02 in a common year');
select is((select dia from public.calendario_mes('2032-02-20', '2032-03-05') where titulo = 'Lia Bissexta'), '2032-02-29'::date, '29/02 birthday shows on 29/02 in a leap year');
select throws_ok($$select * from public.calendario_mes('2030-01-01', '2030-03-01')$$, '22023', null, 'range is limited to 6 weeks');
select throws_ok($$select * from public.calendario_mes('2030-02-01', '2030-01-01')$$, '22023', null, 'end before start is refused');

reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from cal where tipo = 'saida'), 2::bigint, 'seller sees the departures');
select is((select array_agg(titulo) from cal where tipo = 'saldo'), array['Ana Souza'], 'seller sees only balances of reservations she sold');
select is((select count(*) from cal where tipo = 'custo'), 0::bigint, 'seller never sees costs');

reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select array_agg(titulo) from cal where tipo = 'aniversario'), array['Bia Beta'], 'Beta sees only its own clients');

reset role;
set local role anon;
select throws_ok($$select * from public.calendario_mes('2030-11-01', '2030-11-30')$$, '42501', null, 'anon cannot read the calendar');

select * from finish();
rollback;
