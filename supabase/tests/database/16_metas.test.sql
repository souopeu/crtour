begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

-- Owner sets the monthly goal
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.metas (agencia_id, mes, valor_centavos) values (current_setting('t.alfa')::uuid, '2026-10-01', 5000000)$$, 'owner sets the goal of the month');
select throws_ok($$insert into public.metas (agencia_id, mes, valor_centavos) values (current_setting('t.alfa')::uuid, '2026-10-01', 1)$$, '23505', null, 'one goal per month');
select is(public.tmp_rows_affected($$update public.metas set valor_centavos = 6000000$$), 1::bigint, 'owner changes it');
select throws_ok($$insert into public.metas (agencia_id, mes, valor_centavos) values (current_setting('t.alfa')::uuid, '2026-11-15', 100)$$, '23514', null, 'month is stored as its first day');
select throws_ok($$insert into public.metas (agencia_id, mes, valor_centavos) values (current_setting('t.alfa')::uuid, '2026-12-01', 0)$$, '23514', null, 'goal must be positive');
select throws_ok($$insert into public.metas (agencia_id, mes, valor_centavos) values (current_setting('t.beta')::uuid, '2026-10-01', 100)$$, '42501', null, 'not in another agency');

-- The seller sees it but cannot change it
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select valor_centavos from public.metas), 6000000::bigint, 'seller sees the goal');
select is(public.tmp_rows_affected($$update public.metas set valor_centavos = 1$$), 0::bigint, 'seller cannot change the goal');
select is(public.tmp_rows_affected($$delete from public.metas$$), 0::bigint, 'seller cannot delete the goal');
select throws_ok($$insert into public.metas (agencia_id, mes, valor_centavos) values (current_setting('t.alfa')::uuid, '2026-12-01', 100)$$, '42501', null, 'seller cannot create a goal');

reset role;
select is((select count(*) from public.metas where agencia_id = current_setting('t.beta')::uuid), 0::bigint, 'other agency untouched');

select * from finish();
rollback;
