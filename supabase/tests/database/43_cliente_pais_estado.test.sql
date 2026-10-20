begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000431', 'pe-a@test.dev', '{"agencia_nome":"Alfa PE"}'),
  ('bbbbbbbb-0000-0000-0000-000000000432', 'pe-b@test.dev', '{"agencia_nome":"Beta PE"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000431'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000432'), true);

insert into public.clientes (id, agencia_id, nome, cidade) values
  ('a1000000-0000-0000-0000-000000000431', current_setting('t.alfa')::uuid, 'Antiga', 'Recife');
select is((select pais || '/' || coalesce(estado, '-') from public.clientes where id = 'a1000000-0000-0000-0000-000000000431'),
  'Brasil/-', 'a client without country is Brazilian with no state (nothing guessed from the city)');

insert into public.clientes (agencia_id, nome, pais, estado, cidade) values
  (current_setting('t.alfa')::uuid, 'Bia', 'Brasil', 'PE', 'Recife'),
  (current_setting('t.alfa')::uuid, 'Rui', 'Portugal', 'Lisboa', 'Lisboa'),
  (current_setting('t.beta')::uuid, 'Beto', 'Brasil', 'PE', 'Olinda');

select throws_ok($$insert into public.clientes (agencia_id, nome, pais, estado) values (current_setting('t.alfa')::uuid, 'X', 'Brasil', 'Pernambuco')$$,
  '23514', null, 'in Brazil the state must be a UF');
select throws_ok($$insert into public.clientes (agencia_id, nome, pais) values (current_setting('t.alfa')::uuid, 'X', '  ')$$,
  '23514', null, 'country cannot be blank');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000431","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.buscar_clientes(p_estado => 'pe')), 1::bigint, 'state filter ignores case, own agency only');
select is((select estado from public.buscar_clientes(p_estado => 'PE')), 'PE', 'rows bring the state');
select is((select count(*) from public.buscar_clientes(p_estado => 'lisboa')), 1::bigint, 'free-text state abroad');
select is((select array_agg(estado order by estado) from public.estados_dos_clientes()), array['Lisboa', 'PE'], 'distinct states of own clients');

update public.clientes set pais = 'Argentina', estado = 'Mendoza' where nome = 'Bia';
select is((select pais || '/' || estado from public.clientes where nome = 'Bia'), 'Argentina/Mendoza', 'members can change country and state');

select public.importar_clientes('pe.csv', repeat('a', 64), '[{"linha":2,"nome":"Importada PE","pais":"Portugal","estado":"Porto","etiquetas":[]},{"linha":3,"nome":"Importada BR","etiquetas":[]}]'::jsonb);
select is((select array_agg(nome || ':' || pais || '/' || coalesce(estado, '-') order by nome) from public.clientes where nome like 'Importada%'),
  array['Importada BR:Brasil/-', 'Importada PE:Portugal/Porto'], 'import takes country and state; Brasil when absent');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select * from public.estados_dos_clientes()$$, '42501', null, 'anon cannot list states');
select throws_ok($$select * from public.buscar_clientes(p_estado => 'PE')$$, '42501', null, 'anon cannot search');

select * from finish();
rollback;
