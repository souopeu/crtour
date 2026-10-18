begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome, whatsapp, email, cidade, origem) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'João Silva',   '5511999990001', 'joao@x.com', 'São Paulo', 'instagram'),
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Joana Souza',  '5511988880002', null, 'Santos', 'indicacao'),
  ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Maria 100%',   null, null, null, null),
  ('a1000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'Pedro_Alves',  null, null, null, null),
  ('a1000000-0000-0000-0000-000000000005', current_setting('t.alfa')::uuid, 'Ana Souza',    null, 'ana@y.com', 'Santos', null),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'João Beta',    '5521977770003', null, null, null);
insert into public.etiquetas (id, agencia_id, nome) values ('a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Europa');
insert into public.cliente_etiquetas (cliente_id, etiqueta_id, agencia_id) values
  ('a1000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.buscar_clientes()), 5::bigint, 'lists all own clients');
select is((select count(*) from public.buscar_clientes() where nome = 'João Beta'), 0::bigint, 'never lists other agencies');
select is((select nome from public.buscar_clientes() limit 1), 'Ana Souza', 'sorted by name ignoring accents and case');
select is((select count(*) from public.buscar_clientes(p_busca => 'JOAO')), 1::bigint, 'search ignores case and accents');
select is((select count(*) from public.buscar_clientes(p_busca => 'joa')), 2::bigint, 'search matches parts of names');
select is((select nome from public.buscar_clientes(p_busca => 'joa sou')), 'Joana Souza', 'all terms must match');
select is((select count(*) from public.buscar_clientes(p_busca => 'ana@y')), 1::bigint, 'search matches e-mail');
select is((select count(*) from public.buscar_clientes(p_busca => '(11) 99999')), 1::bigint, 'search matches phone digits typed with punctuation');
select is((select nome from public.buscar_clientes(p_busca => '%')), 'Maria 100%', 'percent is literal, not a wildcard');
select is((select nome from public.buscar_clientes(p_busca => '_')), 'Pedro_Alves', 'underscore is literal, not a wildcard');
select is((select nome from public.buscar_clientes(p_etiqueta => 'a2000000-0000-0000-0000-000000000001')), 'Ana Souza', 'filters by tag');
select is((select nome from public.buscar_clientes(p_origem => 'instagram')), 'João Silva', 'filters by origin');
select is((select nome from public.buscar_clientes(p_cidade => 'sao paulo')), 'João Silva', 'filters by city ignoring case and accents');
select is((select count(*) from public.buscar_clientes(p_cidade => 'Santos', p_origem => 'indicacao')), 1::bigint, 'filters combine with AND');
select is((select count(*) from public.buscar_clientes(p_limite => 2)), 2::bigint, 'page size limits rows');
select is((select max(total) from public.buscar_clientes(p_limite => 2)), 5::bigint, 'total counts all matches, not just the page');
select is((select count(*) from public.buscar_clientes(p_limite => 2, p_deslocamento => 4)), 1::bigint, 'offset reaches the last page');
select is((select count(*) from public.buscar_clientes(p_limite => 0)), 1::bigint, 'page size is clamped to at least 1');
select is((select count(*) from public.buscar_clientes(p_busca => '   ')), 5::bigint, 'blank search means no filter');
select is((select array_agg(cidade) from public.cidades_dos_clientes()), array['Santos','São Paulo'], 'lists distinct own cities, sorted');

reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select nome from public.buscar_clientes()), 'João Beta', 'Beta sees only its own client');
select is((select count(*) from public.cidades_dos_clientes()), 0::bigint, 'cities of other agencies are not listed');

reset role;
set local role anon;
select throws_ok($$select * from public.buscar_clientes()$$, '42501', null, 'anon cannot search');

select * from finish();
rollback;
