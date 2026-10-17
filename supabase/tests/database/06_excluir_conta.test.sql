begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

insert into public.clientes (id, agencia_id, nome) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Cliente Alfa'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Cliente Beta');
insert into public.anotacoes (agencia_id, cliente_id, texto) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'nota alfa');
insert into public.passeios (id, agencia_id, nome) values
  ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Passeio Alfa');
insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos) values
  (current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2027-03-10', 10, 1000);
insert into public.importacoes (agencia_id, nome, hash_arquivo) values
  (current_setting('t.alfa')::uuid, 'x.xlsx', repeat('a', 64));

-- Seller cannot delete the account
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.excluir_minha_conta()$$, '42501', null, 'only the owner can delete the account');

-- Owner deletes
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.excluir_minha_conta()$$, 'owner deletes the account');

reset role;
select is((select count(*) from public.agencias where id = current_setting('t.alfa')::uuid), 0::bigint, 'the agency is gone');
select is((select count(*) from public.clientes where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'its clients are gone');
select is((select count(*) from public.passeios where agencia_id = current_setting('t.alfa')::uuid)
        + (select count(*) from public.saidas where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'its tours and departures are gone too');
select is((select count(*) from public.anotacoes where agencia_id = current_setting('t.alfa')::uuid)
        + (select count(*) from public.importacoes where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'its notes and imports are gone');
select is((select count(*) from auth.users where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003')), 0::bigint, 'all users of the agency are removed');
select is((select count(*) from public.clientes where agencia_id = current_setting('t.beta')::uuid)
        + (select count(*) from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 2::bigint, 'other agencies are untouched');

set local role anon;
select throws_ok($$select public.excluir_minha_conta()$$, '42501', null, 'anon cannot delete accounts');

select * from finish();
rollback;
