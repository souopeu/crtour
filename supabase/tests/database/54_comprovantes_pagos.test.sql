begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- E10 security review: receipts of payments the agency made live in <agencia>/pagos/ of the shared bucket
-- and are the owner's only; sellers keep their access to the receipts of payments received.
-- A owns Alfa, C sells in Alfa.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000541', 'cp-a@test.dev', '{"agencia_nome":"Alfa comprovantes"}'),
  ('cccccccc-0000-0000-0000-000000000543', 'cp-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000543');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000543', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000541';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000541'), true);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000541","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('comprovantes', %L)$$, current_setting('t.alfa') || '/pagos/x.pdf'),
  'the owner uploads a receipt of a payment made');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('comprovantes', %L)$$, current_setting('t.alfa') || '/a7000000-0000-0000-0000-000000000541/y.pdf'),
  'the owner uploads a receipt of a payment received');

reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000543","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'comprovantes' and name like '%/pagos/%'), 0::bigint,
  'a seller never sees receipts of payments made');
select is((select count(*) from storage.objects where bucket_id = 'comprovantes'), 1::bigint,
  'a seller still sees receipts of payments received');
-- storage blocks direct deletes (Storage API only); the delete policy uses the same check
select ok(not private.pode_comprovante(current_setting('t.alfa') || '/pagos/x.pdf'), 'a seller cannot delete a receipt of a payment made');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('comprovantes', %L)$$, current_setting('t.alfa') || '/pagos/z.pdf'),
  '42501', null, 'a seller cannot upload into the payments-made folder');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('comprovantes', %L)$$, current_setting('t.alfa') || '/a7000000-0000-0000-0000-000000000542/z.pdf'),
  'a seller still uploads a receipt of a payment received');

select * from finish();
rollback;
