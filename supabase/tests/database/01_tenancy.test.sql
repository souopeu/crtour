begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Three users: A (owner of Alfa), B (owner of a default-named agency), C (seller in Alfa).
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Agência Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');

-- C was given an agency by the trigger; move C into Alfa as seller (what the owner/admin does).
delete from public.agencias
  where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;
select set_config('t.agencia_b', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

select is((select count(*) from public.membros where user_id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002')), 2::bigint, 'each owner signup creates one agency membership');
select is((select count(*) from public.membros where papel = 'dono' and user_id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002')), 2::bigint, 'signup makes the user the owner');
select is((select nome from public.agencias a join public.membros m on m.agencia_id = a.id
           where m.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Agência Alfa', 'agency name comes from signup metadata');
select is((select nome from public.agencias a join public.membros m on m.agencia_id = a.id
           where m.user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'Minha agência', 'agency name defaults when missing');

-- As A
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.agencias), 1::bigint, 'A sees only own agency');
select is((select count(*) from public.membros), 2::bigint, 'A sees members of own agency only');
select is(public.tmp_rows_affected($$update public.agencias set nome = 'Hack' where id = current_setting('t.agencia_b')::uuid$$), 0::bigint, 'A cannot update another agency');
select is(public.tmp_rows_affected($$update public.agencias set nome = 'Alfa Viagens'$$), 1::bigint, 'owner renames own agency');
select throws_ok($$insert into public.agencias (nome) values ('x')$$, '42501', null, 'cannot insert agencies directly');
select throws_ok($$insert into public.membros (user_id, agencia_id) values (gen_random_uuid(), gen_random_uuid())$$, '42501', null, 'cannot insert members directly');
select throws_ok($$update public.membros set papel = 'dono'$$, '42501', null, 'cannot change roles directly');
select throws_ok($$delete from public.agencias$$, '42501', null, 'cannot delete agencies directly');

-- As C (seller in Alfa)
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.membros), 2::bigint, 'seller sees the agency members');
select is(public.tmp_rows_affected($$update public.agencias set nome = 'Seller Hack'$$), 0::bigint, 'seller cannot rename the agency');

-- As anonymous
reset role;
set local role anon;
select throws_ok($$select * from public.agencias$$, '42501', null, 'anon has no access');

select * from finish();
rollback;
