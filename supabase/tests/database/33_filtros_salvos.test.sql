begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

-- Seller saves her own filters
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.filtros_salvos (agencia_id, tela, nome, parametros) values (current_setting('t.alfa')::uuid, 'clientes', 'VIP Europa', 'q=europa')$$, 'member saves a filter');
select is((select user_id::text from public.filtros_salvos where nome = 'VIP Europa'), 'cccccccc-0000-0000-0000-000000000003', 'owner of the filter is the caller');
select throws_ok($$insert into public.filtros_salvos (agencia_id, tela, nome, parametros) values (current_setting('t.alfa')::uuid, 'clientes', ' vip europa ', 'q=x')$$, '23505', null, 'name is unique per person and screen, ignoring case and spaces');
select lives_ok($$insert into public.filtros_salvos (agencia_id, tela, nome, parametros) values (current_setting('t.alfa')::uuid, 'funil', 'VIP Europa', 'q=x')$$, 'same name on another screen is fine');
select throws_ok($$insert into public.filtros_salvos (agencia_id, tela, nome, parametros) values (current_setting('t.alfa')::uuid, 'painel', 'X', '')$$, '23514', null, 'only funil and clientes');
select throws_ok($$insert into public.filtros_salvos (agencia_id, tela, nome, parametros) values (current_setting('t.alfa')::uuid, 'funil', repeat('a', 41), '')$$, '23514', null, 'name up to 40 characters');
select throws_ok($$insert into public.filtros_salvos (agencia_id, tela, nome, parametros) values (current_setting('t.alfa')::uuid, 'funil', 'Longo', repeat('a', 501))$$, '23514', null, 'parameters up to 500 characters');
select throws_ok($$insert into public.filtros_salvos (agencia_id, tela, nome, parametros) values (current_setting('t.beta')::uuid, 'funil', 'Outra', '')$$, '42501', null, 'not into another agency');
select throws_ok($$insert into public.filtros_salvos (agencia_id, user_id, tela, nome, parametros) values (current_setting('t.alfa')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', 'funil', 'Do dono', '')$$, '42501', null, 'cannot save in someone else''s name');
select throws_ok($$insert into public.filtros_salvos (agencia_id, tela, nome, parametros) select current_setting('t.alfa')::uuid, 'clientes', 'F' || g, '' from generate_series(1, 20) g$$, 'CR020', null, 'at most 20 per person and screen');

-- The owner neither sees nor changes the seller's filters
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.filtros_salvos), 0::bigint, 'owner does not see the seller''s filters');
select is(public.tmp_rows_affected($$delete from public.filtros_salvos$$), 0::bigint, 'owner cannot delete them');

-- The seller renames and deletes her own
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_rows_affected($$update public.filtros_salvos set nome = 'Europa VIP' where nome = 'VIP Europa' and tela = 'clientes'$$), 1::bigint, 'seller renames her filter');
select is(public.tmp_rows_affected($$delete from public.filtros_salvos where tela = 'funil'$$), 1::bigint, 'seller deletes her filter');

reset role;
select * from finish();
rollback;
