begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- E9-2 (R137–R138): vehicles, and vehicle + time on a departure. A owns Alfa, C sells in Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000471', 'vei-a@test.dev', '{"agencia_nome":"Alfa veículos"}'),
  ('bbbbbbbb-0000-0000-0000-000000000472', 'vei-b@test.dev', '{"agencia_nome":"Beta veículos"}'),
  ('cccccccc-0000-0000-0000-000000000473', 'vei-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000473');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000473', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000471';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000471'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000472'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000471', current_setting('t.alfa')::uuid, 'Ana Van');
insert into public.passeios (id, agencia_id, nome) values ('a2000000-0000-0000-0000-000000000471', current_setting('t.alfa')::uuid, 'Litoral sul');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000471', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000471', '2027-06-10', 20, 10000);
insert into public.reservas (agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  (current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000471', 'a1000000-0000-0000-0000-000000000471', 16, 160000);
insert into public.veiculos (id, agencia_id, nome, categoria, lugares) values
  ('b5000000-0000-0000-0000-000000000472', current_setting('t.beta')::uuid, 'Van da Beta', 'van', 15);

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000473","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$insert into public.veiculos (id, agencia_id, nome, categoria, lugares)
  values ('a5000000-0000-0000-0000-000000000471', current_setting('t.alfa')::uuid, 'Van 01', 'van', 15)$$, 'a seller registers a vehicle');
select throws_ok($$insert into public.veiculos (agencia_id, nome, categoria, lugares) values (current_setting('t.alfa')::uuid, 'Grande', 'onibus', 501)$$,
  '23514', null, 'seats go from 1 to 500');
select throws_ok($$insert into public.veiculos (agencia_id, nome, categoria, lugares) values (current_setting('t.beta')::uuid, 'Intrusa', 'van', 10)$$,
  '42501', null, 'cannot register in another agency');
select is((select count(*) from public.veiculos), 1::bigint, 'each agency sees only its own vehicles');

select lives_ok($$update public.saidas set horario = '08:00' where id = 'a3000000-0000-0000-0000-000000000471'$$, 'a departure gets a time');
select throws_ok($$update public.saidas set veiculo_id = 'a5000000-0000-0000-0000-000000000471' where id = 'a3000000-0000-0000-0000-000000000471'$$,
  'CR019', null, 'a 15-seat van cannot take a departure of 20 places (16 sold)');
select throws_ok($$update public.saidas set veiculo_id = 'a5000000-0000-0000-0000-000000000471', capacidade = 15 where id = 'a3000000-0000-0000-0000-000000000471'$$,
  'CR003', null, 'and capacity cannot drop below the 16 already sold');
select throws_ok($$update public.saidas set veiculo_id = 'b5000000-0000-0000-0000-000000000472' where id = 'a3000000-0000-0000-0000-000000000471'$$,
  '23503', null, 'a vehicle of another agency cannot be used');

update public.veiculos set lugares = 30 where id = 'a5000000-0000-0000-0000-000000000471';
select lives_ok($$update public.saidas set veiculo_id = 'a5000000-0000-0000-0000-000000000471' where id = 'a3000000-0000-0000-0000-000000000471'$$, 'a vehicle with room fits');
select is((select horario::text from public.saidas where id = 'a3000000-0000-0000-0000-000000000471'), '08:00:00', 'the time is kept');
select throws_ok($$update public.veiculos set lugares = 18 where id = 'a5000000-0000-0000-0000-000000000471'$$,
  'CR019', null, 'a vehicle cannot shrink below a departure that uses it');
delete from public.veiculos where id = 'a5000000-0000-0000-0000-000000000471';
select is((select count(*) from public.veiculos where id = 'a5000000-0000-0000-0000-000000000471'), 1::bigint, 'only the owner deletes: a seller deleting removes nothing');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000471","role":"authenticated"}', true);
select throws_ok($$delete from public.veiculos where id = 'a5000000-0000-0000-0000-000000000471'$$, '23503', null, 'a vehicle in use is archived, not deleted');
select lives_ok($$update public.veiculos set arquivado = true where id = 'a5000000-0000-0000-0000-000000000471'$$, 'the owner archives it');

select * from finish();
rollback;
