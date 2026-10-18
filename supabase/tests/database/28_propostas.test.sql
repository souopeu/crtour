begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Viagens Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana');
insert into public.passeios (id, agencia_id, nome) values ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa');
insert into public.negociacoes (id, agencia_id, cliente_id, titulo) values
  ('a9000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Lisboa da Ana');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
-- R69: a member creates a proposal; the values are a frozen snapshot
select lives_ok(format($$insert into public.propostas (agencia_id, negociacao_id, dados, validade) values (%L, 'a9000000-0000-0000-0000-000000000001', '{"cliente":"Ana","totalCentavos":900000}', (now() at time zone 'America/Sao_Paulo')::date + 7)$$, current_setting('t.alfa')),
  'a member creates a proposal for a deal of the agency');
select ok((select codigo ~ '^[A-Za-z0-9_-]{24}$' from public.propostas where negociacao_id = 'a9000000-0000-0000-0000-000000000001'), 'R70: random 24-character code');
select set_config('t.cod', (select codigo from public.propostas where negociacao_id = 'a9000000-0000-0000-0000-000000000001'), true);
select throws_ok(format($$insert into public.propostas (agencia_id, negociacao_id, dados, validade, codigo) values (%L, 'a9000000-0000-0000-0000-000000000001', '{}', current_date, 'AAAAAAAAAAAAAAAAAAAAAAAA')$$, current_setting('t.alfa')),
  '42501', null, 'the code cannot be chosen by hand');
select throws_ok($$update public.propostas set dados = '{"totalCentavos":1}'$$, '42501', null, 'the frozen values cannot be changed');
select lives_ok($$update public.passeios set inclui = 'Aéreo e hotel', nao_inclui = 'Refeições' where id = 'a5000000-0000-0000-0000-000000000001'$$, 'tours keep what is and is not included');
reset role;

-- Another agency: cannot see nor attach a proposal to this deal
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.propostas), 0::bigint, 'another agency sees no proposals');
select throws_ok(format($$insert into public.propostas (agencia_id, negociacao_id, dados, validade) values (%L, 'a9000000-0000-0000-0000-000000000001', '{}', current_date)$$, current_setting('t.alfa')),
  '42501', null, 'another agency cannot create a proposal here');
reset role;

-- Public link: only the snapshot, only while valid and not revoked
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select dados->>'cliente' from public.proposta_publica(current_setting('t.cod'))), 'Ana', 'the public link shows the proposal');
select is((select count(*) from public.proposta_publica('codigo-errado-00000000000')), 0::bigint, 'a wrong code shows nothing');
select throws_ok($$select count(*) from public.propostas$$, '42501', null, 'visitors cannot read the proposals table');
reset role;

update public.propostas set revogada_em = now() where codigo = current_setting('t.cod');
set local role anon;
select is((select count(*) from public.proposta_publica(current_setting('t.cod'))), 0::bigint, 'a revoked proposal is unavailable');
reset role;

insert into public.propostas (agencia_id, negociacao_id, dados, validade) values (current_setting('t.alfa')::uuid, 'a9000000-0000-0000-0000-000000000001', '{"cliente":"Ana"}', (now() at time zone 'America/Sao_Paulo')::date - 1);
select set_config('t.vencida', (select codigo from public.propostas where validade < (now() at time zone 'America/Sao_Paulo')::date and agencia_id = current_setting('t.alfa')::uuid), true);
set local role anon;
select is((select count(*) from public.proposta_publica(current_setting('t.vencida'))), 0::bigint, 'an expired proposal is unavailable');
reset role;
select is((select count(*) from public.propostas where agencia_id = current_setting('t.alfa')::uuid), 2::bigint, 'proposals stay in the history');

select * from finish();
rollback;
