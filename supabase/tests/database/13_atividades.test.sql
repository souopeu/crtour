begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

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
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Beto'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Bia');
insert into public.negociacoes (id, agencia_id, cliente_id, titulo) values
  ('a4000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Da Ana'),
  ('a4000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000002', 'Do Beto');

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

-- Constraints that hold even without RLS
select throws_ok($$insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando) values (current_setting('t.alfa')::uuid, 'b1000000-0000-0000-0000-000000000001', 'ligacao', 'x', now())$$, '23503', null, 'cannot log an activity for another agency''s client');
select throws_ok($$insert into public.atividades (agencia_id, cliente_id, negociacao_id, tipo, titulo, quando) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002', 'ligacao', 'x', now())$$, '23503', null, 'a deal must belong to the same client as the activity');
select throws_ok($$insert into public.atividades (agencia_id, cliente_id, responsavel_id, tipo, titulo, quando) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'ligacao', 'x', now())$$, '23503', null, 'the person in charge must belong to the agency');
select throws_ok($$insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'ligacao', '   ', now())$$, '23514', null, 'a title is required');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- A pending activity is not an interaction yet
insert into public.atividades (id, agencia_id, cliente_id, tipo, titulo, quando) values
  ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'ligacao', 'Ligar para a Ana', now() + interval '1 day');
select is((select status::text || '|' || (feito_em is null)::text || '|' || (criado_por = 'aaaaaaaa-0000-0000-0000-000000000001')::text from public.atividades where id = 'a5000000-0000-0000-0000-000000000001'), 'pendente|true|true', 'starts pending, not done, creator from the session');
select is((select ultima_interacao_em from public.clientes where id = 'a1000000-0000-0000-0000-000000000001'), null, 'a pending activity does not count as an interaction');

-- Marking it done updates the client
select is(public.tmp_rows_affected($$update public.atividades set status = 'feito' where id = 'a5000000-0000-0000-0000-000000000001'$$), 1::bigint, 'marks as done');
select is((select (c.ultima_interacao_em = a.feito_em)::text || '|' || (a.feito_em is not null)::text from public.clientes c, public.atividades a where c.id = 'a1000000-0000-0000-0000-000000000001' and a.id = 'a5000000-0000-0000-0000-000000000001'), 'true|true', 'last interaction follows the moment it was done');

-- Logging a past contact as already done
insert into public.atividades (id, agencia_id, cliente_id, tipo, titulo, quando, status) values
  ('a5000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'reuniao', 'Reunião de ontem', now() - interval '1 day', 'feito');
select is((select (feito_em = quando)::text from public.atividades where id = 'a5000000-0000-0000-0000-000000000002'), 'true', 'a past contact logged as done keeps its own date');
select is((select (ultima_interacao_em > now() - interval '1 hour')::text from public.clientes where id = 'a1000000-0000-0000-0000-000000000001'), 'true', 'the last interaction is the most recent done activity');

-- Undo and delete recalculate
select is(public.tmp_rows_affected($$update public.atividades set status = 'pendente' where id = 'a5000000-0000-0000-0000-000000000001'$$), 1::bigint, 'unmarks as done');
select is((select (ultima_interacao_em < now() - interval '23 hours')::text from public.clientes where id = 'a1000000-0000-0000-0000-000000000001'), 'true', 'undoing falls back to the previous done activity');
select is((select feito_em is null from public.atividades where id = 'a5000000-0000-0000-0000-000000000001'), true, 'the done moment is cleared');
select is(public.tmp_rows_affected($$delete from public.atividades where id = 'a5000000-0000-0000-0000-000000000002'$$), 1::bigint, 'the author deletes an activity');
select is((select ultima_interacao_em from public.clientes where id = 'a1000000-0000-0000-0000-000000000001'), null, 'deleting the last done activity clears the last interaction');

-- Notes alone never count
select lives_ok($$insert into public.anotacoes (agencia_id, cliente_id, texto) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'só uma anotação')$$, 'adds a note');
select is((select ultima_interacao_em from public.clientes where id = 'a1000000-0000-0000-0000-000000000001'), null, 'a note does not set the last interaction');

-- A WhatsApp registered as done, linked to a deal of the same client
select lives_ok($$insert into public.atividades (agencia_id, cliente_id, negociacao_id, tipo, titulo, quando, status) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'whatsapp', 'WhatsApp: Olá, Ana!', now(), 'feito')$$, 'registers a WhatsApp as done, linked to a deal');
select is((select (ultima_interacao_em > now() - interval '1 minute')::text from public.clientes where id = 'a1000000-0000-0000-0000-000000000001'), 'true', 'it sets the last interaction');
select throws_ok($$update public.clientes set ultima_interacao_em = now()$$, '42501', null, 'the last interaction cannot be written by hand');
select throws_ok($$update public.atividades set cliente_id = 'a1000000-0000-0000-0000-000000000002'$$, '42501', null, 'an activity cannot move to another client');

-- Seller: can create, cannot delete someone else's; owner can delete anything
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.atividades (id, agencia_id, cliente_id, tipo, titulo, quando, responsavel_id) values ('a5000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000002', 'tarefa', 'Enviar proposta', now(), 'cccccccc-0000-0000-0000-000000000003')$$, 'the seller creates activities');
select is(public.tmp_rows_affected($$delete from public.atividades where titulo like 'WhatsApp%'$$), 0::bigint, 'the seller cannot delete another person''s activity');
select is(public.tmp_rows_affected($$delete from public.atividades where id = 'a5000000-0000-0000-0000-000000000003'$$), 1::bigint, 'the seller deletes her own');
select lives_ok($$insert into public.atividades (id, agencia_id, cliente_id, tipo, titulo, quando) values ('a5000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000002', 'ligacao', 'Da vendedora', now())$$, 'she logs another one');

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_rows_affected($$delete from public.atividades where id = 'a5000000-0000-0000-0000-000000000004'$$), 1::bigint, 'the owner deletes any activity of the agency');

-- Isolation
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.atividades), 0::bigint, 'another agency sees no activities');
select throws_ok($$insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'ligacao', 'invasor', now())$$, '42501', null, 'another agency cannot log activities for Alfa');

set local role anon;
select throws_ok($$select * from public.atividades$$, '42501', null, 'anon has no access');

-- Deleting a client removes its activities; deleting the account removes everything
reset role;
select lives_ok($$delete from public.negociacao_eventos where negociacao_id = 'a4000000-0000-0000-0000-000000000002'; delete from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000002'; delete from public.clientes where id = 'a1000000-0000-0000-0000-000000000002'$$, 'a client (with no deals) can be deleted together with its activities');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.excluir_minha_conta()$$, 'the owner can delete an account that has activities');
reset role;
select is((select count(*) from public.atividades where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'activities are gone with the account');

select * from finish();
rollback;
