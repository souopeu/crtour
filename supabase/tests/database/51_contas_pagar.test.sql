begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- E10-1 (R145–R148): bills of the agency. A owns Alfa, C sells in Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000511', 'cp-a@test.dev', '{"agencia_nome":"Alfa contas"}'),
  ('bbbbbbbb-0000-0000-0000-000000000512', 'cp-b@test.dev', '{"agencia_nome":"Beta contas"}'),
  ('cccccccc-0000-0000-0000-000000000513', 'cp-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000513');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000513', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000511';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000511'), true);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000511","role":"authenticated"}', true);
set local role authenticated;

-- Single bill
select set_config('t.aluguel', public.criar_conta_pagar('Aluguel da loja', 'aluguel', 250000, '2027-01-10', null, null)::text, true);
select is((select valor_centavos from public.contas_pagar where id = current_setting('t.aluguel')::uuid), 250000, 'a single bill keeps its value');
select is((select grupo_id from public.contas_pagar where id = current_setting('t.aluguel')::uuid), null, 'and has no group');

-- In 3 instalments: cents left over go to the first; one per month, same day
select set_config('t.parc', public.criar_conta_pagar('Notebook', 'sistemas', 100000, '2027-01-31', null, null, 3)::text, true);
select is((select array_agg(valor_centavos order by parcela) from public.contas_pagar where grupo_id = (select grupo_id from public.contas_pagar where id = current_setting('t.parc')::uuid)),
  array[33334, 33333, 33333], '1.000,00 in 3 = 333,34 + 333,33 + 333,33');
select is((select array_agg(vencimento::text order by parcela) from public.contas_pagar where grupo_id = (select grupo_id from public.contas_pagar where id = current_setting('t.parc')::uuid)),
  array['2027-01-31', '2027-02-28', '2027-03-31'], 'the 31st becomes the last day of a short month, then back to 31');
select is((select array_agg(parcela || '/' || total_parcelas order by parcela) from public.contas_pagar where grupo_id = (select grupo_id from public.contas_pagar where id = current_setting('t.parc')::uuid)),
  array['1/3', '2/3', '3/3'], 'each instalment says which one it is');

-- Pay and undo
select lives_ok($$update public.contas_pagar set pago_em = '2027-01-05', forma_pago = 'pix' where id = current_setting('t.aluguel')::uuid$$, 'the owner pays a bill');
select throws_ok($$update public.contas_pagar set pago_em = '2027-01-05', forma_pago = null where id = current_setting('t.aluguel')::uuid$$, '23514', null, 'a payment needs its form');
select lives_ok($$update public.contas_pagar set pago_em = null, forma_pago = null where id = current_setting('t.aluguel')::uuid$$, 'and undoes it');

-- Delete this and the next instalments
select lives_ok($$select public.excluir_conta_pagar((select id from public.contas_pagar where grupo_id = (select grupo_id from public.contas_pagar where id = current_setting('t.parc')::uuid) and parcela = 2), true)$$, 'delete from the 2nd instalment on');
select is((select count(*) from public.contas_pagar where grupo_id = (select grupo_id from public.contas_pagar where id = current_setting('t.parc')::uuid)), 1::bigint, 'only the 1st is left');

-- Monthly recurrence: the clock creates the next 30 days before the due date, never twice.
-- The clock runs for every agency (the local database keeps other tests' data), so count only this series.
select set_config('t.rec', public.criar_conta_pagar('Sistema de reservas', 'sistemas', 9900, '2027-01-15', null, null, 1, true)::text, true);
reset role;
select public.gerar_recorrencias('2026-12-10');
select is((select count(*) from public.contas_pagar where grupo_id = (select grupo_id from public.contas_pagar where id = current_setting('t.rec')::uuid)), 1::bigint, 'more than 30 days before: nothing yet');
select public.gerar_recorrencias('2026-12-20');
select is((select count(*) from public.contas_pagar where grupo_id = (select grupo_id from public.contas_pagar where id = current_setting('t.rec')::uuid)), 2::bigint, '30 days before the due date: the next month is created');
select public.gerar_recorrencias('2026-12-21');
select is((select count(*) from public.contas_pagar where grupo_id = (select grupo_id from public.contas_pagar where id = current_setting('t.rec')::uuid)), 2::bigint, 'running again creates nothing');
select is((select array_agg(vencimento::text order by parcela) from public.contas_pagar where grupo_id = (select grupo_id from public.contas_pagar where id = current_setting('t.rec')::uuid)),
  array['2027-01-15', '2027-02-15'], 'same day next month');
set local role authenticated;
select lives_ok($$select public.parar_recorrencia((select grupo_id from public.contas_pagar where id = current_setting('t.rec')::uuid))$$, 'the owner stops the series');
reset role;
select public.gerar_recorrencias('2027-02-01');
select is((select count(*) from public.contas_pagar where grupo_id = (select grupo_id from public.contas_pagar where id = current_setting('t.rec')::uuid)), 2::bigint, 'a stopped series creates nothing');
set local role authenticated;
select throws_ok($$select public.gerar_recorrencias()$$, '42501', null, 'only the server clock generates bills');

-- R144: the seller sees no bill; another agency neither
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000513","role":"authenticated"}', true);
select is((select count(*) from public.contas_pagar), 0::bigint, 'a seller sees no bills');

select * from finish();
rollback;
