begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Bia');
insert into public.passeios (id, agencia_id, nome) values ('b2000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Praia');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('b3000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b2000000-0000-0000-0000-000000000001', '2027-05-10', 5, 100000);
insert into public.negociacoes (id, agencia_id, cliente_id, titulo) values
  ('b4000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b1000000-0000-0000-0000-000000000001', 'Negociação Beta');

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

-- Constraints that hold even without RLS (as postgres)
select throws_ok($$insert into public.negociacoes (agencia_id, cliente_id, titulo) values (current_setting('t.alfa')::uuid, 'b1000000-0000-0000-0000-000000000001', 'x')$$, '23503', null, 'cannot negotiate with another agency''s client');
select throws_ok($$insert into public.negociacoes (agencia_id, cliente_id, titulo, saida_id) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'x', 'b3000000-0000-0000-0000-000000000001')$$, '23503', null, 'cannot link another agency''s departure');
select throws_ok($$insert into public.negociacoes (agencia_id, cliente_id, titulo, responsavel_id) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'x', 'bbbbbbbb-0000-0000-0000-000000000002')$$, '23503', null, 'the person in charge must belong to the same agency');
select throws_ok($$insert into public.negociacoes (agencia_id, cliente_id, titulo) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', '   ')$$, '23514', null, 'a title is required');
select throws_ok($$insert into public.negociacoes (agencia_id, cliente_id, titulo, valor_centavos) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'x', 1000000001)$$, '23514', null, 'value has an upper limit');
select throws_ok($$insert into public.negociacoes (agencia_id, cliente_id, titulo, probabilidade) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'x', 101)$$, '23514', null, 'probability is 0 to 100');
select throws_ok($$insert into public.negociacoes (agencia_id, cliente_id, titulo, etapa) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'x', 'perdido')$$, '23514', null, 'a lost deal needs a reason (enforced by the database)');
select throws_ok($$insert into public.negociacoes (agencia_id, cliente_id, titulo, motivo_perda) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'x', 'achou_caro')$$, '23514', null, 'a reason only makes sense for a lost deal');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- Creating and the automatic forecast
insert into public.negociacoes (id, agencia_id, cliente_id, titulo, valor_centavos)
  values ('a4000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Lisboa em março', 1000000);
select is((select etapa::text || '|' || probabilidade || '|' || valor_previsto_centavos from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'),
  'interessado|10|100000', 'a new deal starts as "interessado" at 10% with the forecast computed (value x probability)');
select is((select criado_por from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'the creator comes from the session');
insert into public.negociacoes (id, agencia_id, cliente_id, titulo)
  values ('a4000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Sem valor ainda');
select is((select valor_previsto_centavos from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000002'), 0, 'a deal without value has forecast 0');

-- Stage changes
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'orcamento' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'moves to the next stage');
select is((select probabilidade || '|' || valor_previsto_centavos from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'), '30|300000', 'the stage default probability is applied and the forecast follows');
select is(public.tmp_rows_affected($$update public.negociacoes set probabilidade = 50 where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'a manual probability is accepted');
select is((select probabilidade || '|' || valor_previsto_centavos from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'), '50|500000', 'a manual probability sticks until the next stage change');
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'reservado' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'moves again');
select is((select probabilidade from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'), 70::smallint, 'the next stage change resets the probability to its default');
select is(public.tmp_rows_affected($$update public.negociacoes set valor_centavos = 2000000 where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'the value can change');
select is((select valor_previsto_centavos from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'), 1400000, 'the forecast is recomputed by the database');
select throws_ok($$update public.negociacoes set valor_previsto_centavos = 1$$, '428C9', null, 'the forecast is a generated column: it cannot be written by hand');

-- Won / lost
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'pago' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'enters "pago"');
select is((select (fechado_em = (now() at time zone 'America/Sao_Paulo')::date)::text || '|' || probabilidade from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'), 'true|100', 'winning stamps today as the closing date at 100%');
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'viajou' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'moves from "pago" to "viajou"');
select isnt((select fechado_em from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'), null, 'staying in won stages keeps the closing date');
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'orcamento' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'goes back to an open stage');
select is((select fechado_em from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'), null, 'leaving the won stages clears the closing date');
select throws_ok($$update public.negociacoes set etapa = 'perdido' where id = 'a4000000-0000-0000-0000-000000000001'$$, '23514', null, 'lost without a reason is refused');
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'perdido', motivo_perda = 'achou_caro' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'lost with a reason works');
select is((select probabilidade from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'), 0::smallint, 'a lost deal has probability 0');

-- History
select is((select count(*) from public.negociacao_eventos where negociacao_id = 'a4000000-0000-0000-0000-000000000001'), 7::bigint, 'every stage change (and creation) is recorded');
select is((select de::text || '>' || para::text from public.negociacao_eventos where negociacao_id = 'a4000000-0000-0000-0000-000000000001' order by em desc, id limit 1), 'orcamento>perdido', 'the last event says from which stage to which');
select is((select de is null from public.negociacao_eventos where negociacao_id = 'a4000000-0000-0000-0000-000000000001' order by em, id limit 1), true, 'the first event is the creation');
select throws_ok($$insert into public.negociacao_eventos (agencia_id, negociacao_id, para) values (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', 'pago')$$, '42501', null, 'history cannot be written directly');
select throws_ok($$delete from public.negociacao_eventos$$, '42501', null, 'history cannot be deleted');
select throws_ok($$delete from public.negociacoes$$, '42501', null, 'deals are never deleted (move them to lost instead)');

-- Isolation
select is((select count(*) from public.negociacoes where agencia_id = current_setting('t.beta')::uuid), 0::bigint, 'A does not see Beta deals');
select throws_ok($$insert into public.negociacoes (agencia_id, cliente_id, titulo) values (current_setting('t.beta')::uuid, 'b1000000-0000-0000-0000-000000000001', 'Invasor')$$, '42501', null, 'A cannot create deals in another agency');
select is(public.tmp_rows_affected($$update public.negociacoes set titulo = 'Hack' where id = 'b4000000-0000-0000-0000-000000000001'$$), 0::bigint, 'A cannot change a Beta deal');
select throws_ok($$update public.negociacoes set cliente_id = 'a1000000-0000-0000-0000-000000000001', agencia_id = current_setting('t.beta')::uuid where id = 'a4000000-0000-0000-0000-000000000002'$$, '42501', null, 'client and agency of a deal cannot be changed');

-- Seller
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.negociacoes (agencia_id, cliente_id, titulo, responsavel_id) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Da vendedora', 'cccccccc-0000-0000-0000-000000000003')$$, 'seller creates deals (in charge of herself)');
select is((select count(*) from public.negociacoes), 3::bigint, 'seller sees the agency deals');

-- Beta sees nothing of Alfa
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.negociacoes where agencia_id = current_setting('t.alfa')::uuid) + (select count(*) from public.negociacao_eventos where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'Beta sees neither Alfa deals nor their history');

reset role;
select throws_ok($$delete from public.clientes where id = 'a1000000-0000-0000-0000-000000000001'$$, '23503', null, 'a client with deals cannot be deleted');
set local role anon;
select throws_ok($$select * from public.negociacoes$$, '42501', null, 'anon has no access');

-- Deleting the account removes deals and history
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.excluir_minha_conta()$$, 'the owner can delete an account that has deals');
reset role;
select is((select count(*) from public.negociacoes where agencia_id = current_setting('t.alfa')::uuid) + (select count(*) from public.negociacao_eventos where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'deals and history are gone with the account');

select * from finish();
rollback;
