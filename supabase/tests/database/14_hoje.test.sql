begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

select is((select dias_sem_contato || '/' || dias_negociacao_parada from public.agencias where id = current_setting('t.alfa')::uuid), '30/7', 'defaults: 30 days without contact, 7 days stalled');

-- The seller cannot change the thresholds
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_rows_affected($$update public.agencias set dias_sem_contato = 10$$), 0::bigint, 'seller cannot change the thresholds');

-- The owner can, within limits, only for their agency
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_rows_affected($$update public.agencias set dias_sem_contato = 45, dias_negociacao_parada = 14$$), 1::bigint, 'owner changes the thresholds of their own agency only');
select is((select dias_sem_contato || '/' || dias_negociacao_parada from public.agencias), '45/14', 'new thresholds saved');
select throws_ok($$update public.agencias set dias_sem_contato = 0$$, '23514', null, 'zero days is refused');
select throws_ok($$update public.agencias set dias_negociacao_parada = 366$$, '23514', null, 'more than a year is refused');
select throws_ok($$update public.agencias set criada_em = now()$$, '42501', null, 'other columns stay read-only');

reset role;
select is((select dias_sem_contato from public.agencias where id = current_setting('t.beta')::uuid), 30::smallint, 'other agency untouched');
select has_index('public', 'clientes', 'clientes_agencia_interacao_idx', 'index for "sem contato" lookups');

select * from finish();
rollback;
