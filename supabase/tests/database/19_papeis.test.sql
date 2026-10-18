begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'dono@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);
select set_config('t.hash', encode(extensions.digest('token-certo-123', 'sha256'), 'hex'), true);

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

-- The owner invites a seller
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.convites (agencia_id, email, nome, token_hash) values (current_setting('t.alfa')::uuid, 'vera@test.dev', 'Vera', current_setting('t.hash'))$$, 'owner creates an invite');
select throws_ok($$insert into public.convites (agencia_id, email, nome, token_hash) values (current_setting('t.alfa')::uuid, 'Vera@Test.dev', 'Vera', 'x')$$, '23514', null, 'e-mail must be stored in lower case');
select throws_ok($$insert into public.convites (agencia_id, email, nome, token_hash) values (current_setting('t.beta')::uuid, 'z@test.dev', 'Z', 'x')$$, '42501', null, 'not for another agency');
reset role;

-- Checking a link (before signing up)
select ok(public.verificar_convite('token-certo-123', 'VERA@test.dev'), 'right token and e-mail (any case)');
select ok(not public.verificar_convite('token-errado', 'vera@test.dev'), 'wrong token');
select ok(not public.verificar_convite('token-certo-123', 'outra@test.dev'), 'wrong e-mail');

-- Signing up with the wrong e-mail for the token is refused
select throws_ok($$insert into auth.users (id, email, raw_user_meta_data) values ('dddddddd-0000-0000-0000-000000000004', 'intrusa@test.dev', '{"nome":"Intrusa","convite":"token-certo-123"}')$$, 'CR011', null, 'an invite token only works with its e-mail');

-- Signing up with the invite joins the agency as seller; no new agency
insert into auth.users (id, email, raw_user_meta_data) values ('cccccccc-0000-0000-0000-000000000003', 'Vera@test.dev', '{"nome":"Vera Vendas","agencia_nome":"Ignorada","convite":"token-certo-123"}');
select is((select agencia_id::text || '|' || papel || '|' || nome from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003'),
  current_setting('t.alfa') || '|vendedor|Vera Vendas', 'seller joins the inviting agency');
select is((select count(*) from public.agencias where nome = 'Ignorada'), 0::bigint, 'no agency is created for her');
select isnt((select aceito_em from public.convites where email = 'vera@test.dev'), null, 'invite marked as used');
select ok(not public.verificar_convite('token-certo-123', 'vera@test.dev'), 'a used invite no longer works');

-- Expired invites do not work
insert into public.convites (agencia_id, email, nome, token_hash, expira_em) values
  (current_setting('t.alfa')::uuid, 'velha@test.dev', 'Velha', encode(extensions.digest('token-velho', 'sha256'), 'hex'), now() - interval '1 minute');
select ok(not public.verificar_convite('token-velho', 'velha@test.dev'), 'expired invite');

-- Normal signup still creates an agency with its owner
insert into auth.users (id, email, raw_user_meta_data) values ('eeeeeeee-0000-0000-0000-000000000005', 'nova@test.dev', '{"agencia_nome":"Nova"}');
select is((select papel::text from public.membros where user_id = 'eeeeeeee-0000-0000-0000-000000000005'), 'dono', 'signup without invite = owner of a new agency');

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Maria');
insert into public.negociacoes (id, agencia_id, cliente_id, titulo, responsavel_id) values
  ('a4000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Lisboa', 'cccccccc-0000-0000-0000-000000000003');

-- R41: the seller works with deals but cannot delete them, nor touch the goal, invites or the team
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'orcamento'$$), 1::bigint, 'seller moves a deal');
select throws_ok($$delete from public.negociacoes$$, '42501', null, 'seller cannot delete a deal');
select throws_ok($$insert into public.metas (agencia_id, mes, valor_centavos) values (current_setting('t.alfa')::uuid, '2026-10-01', 100)$$, '42501', null, 'seller cannot set the goal');
select is((select count(*) from public.convites), 0::bigint, 'seller does not see invites');
select throws_ok($$insert into public.convites (agencia_id, email, nome, token_hash) values (current_setting('t.alfa')::uuid, 'x@test.dev', 'X', 'x')$$, '42501', null, 'seller cannot invite');
select throws_ok($$select public.remover_membro('aaaaaaaa-0000-0000-0000-000000000001')$$, '42501', null, 'seller cannot remove anyone');
reset role;

-- Another agency's owner cannot remove her
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.remover_membro('cccccccc-0000-0000-0000-000000000003')$$, '42501', null, 'owner of another agency cannot remove her');
reset role;

-- The owner removes the seller; her deals stay, without a person in charge
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.remover_membro('aaaaaaaa-0000-0000-0000-000000000001')$$, '42501', null, 'the owner cannot remove herself');
select lives_ok($$select public.remover_membro('cccccccc-0000-0000-0000-000000000003')$$, 'owner removes the seller');
select is((select count(*) from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003'), 0::bigint, 'she is no longer a member');
select is((select responsavel_id from public.negociacoes), null, 'her deals stay, without a person in charge');

select * from finish();
rollback;
