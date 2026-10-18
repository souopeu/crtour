begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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

insert into public.clientes (id, agencia_id, nome, whatsapp, email) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'João Silva',  '5511999990001', 'joao@x.com'),
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Maria 100%',  null, null),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'João Beta',   '5521977770003', null);
insert into public.clientes (agencia_id, nome)
  select current_setting('t.alfa')::uuid, 'Grupo Lisboa ' || g from generate_series(1, 7) g;

insert into public.negociacoes (id, agencia_id, cliente_id, titulo) values
  ('a3000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Lua de mel em Maldivas'),
  ('b3000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b1000000-0000-0000-0000-000000000001', 'Maldivas Beta');

insert into public.passeios (id, agencia_id, nome, destino, arquivado) values
  ('a4000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Gramado no inverno', 'Serra Gaúcha', false),
  ('a4000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Gramado antigo',     'Serra Gaúcha', true),
  ('b4000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Gramado Beta',       null,           false);
insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos, situacao) values
  (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', current_date - 10, 20, 100000, 'encerrada'),
  (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', current_date + 40, 20, 100000, 'aberta'),
  (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', current_date + 5,  20, 100000, 'cancelada'),
  (current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', current_date + 70, 20, 100000, 'aberta');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.busca_global('j')), 0::bigint, 'one letter returns nothing');
select is((select count(*) from public.busca_global('  ')), 0::bigint, 'blank returns nothing');
select is((select titulo from public.busca_global('JOAO') where tipo = 'cliente'), 'João Silva', 'client by name, ignoring case and accents');
select is((select titulo from public.busca_global('(11) 99999') where tipo = 'cliente'), 'João Silva', 'client by WhatsApp digits');
select is((select count(*) from public.busca_global('joão') where titulo = 'João Beta'), 0::bigint, 'never finds other agencies');
select is((select titulo from public.busca_global('maldivas') where tipo = 'negociacao'), 'Lua de mel em Maldivas', 'deal by title, own agency only');
select is((select detalhe from public.busca_global('maldivas') where tipo = 'negociacao'), 'João Silva', 'deal shows the client name');
select is((select titulo from public.busca_global('silva') where tipo = 'negociacao'), 'Lua de mel em Maldivas', 'deal by client name');
select is((select titulo from public.busca_global('gramado') where tipo = 'passeio'), 'Gramado no inverno', 'tour by name; archived and other agencies left out');
select is((select titulo from public.busca_global('serra gau') where tipo = 'passeio'), 'Gramado no inverno', 'tour by destination');
select is((select data from public.busca_global('gramado') where tipo = 'passeio'), current_date + 40, 'tour shows its next open departure');
select is((select count(*) from public.busca_global('lisboa') where tipo = 'cliente'), 5::bigint, 'at most 5 per group');
select is((select titulo from public.busca_global('0%') where tipo = 'cliente'), 'Maria 100%', 'percent is literal, not a wildcard');

reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.busca_global('maldivas')), 1::bigint, 'seller finds what her screens show (same agency)');

reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select titulo from public.busca_global('maldivas')), 'Maldivas Beta', 'Beta sees only its own deal');

reset role;
set local role anon;
select throws_ok($$select * from public.busca_global('joao')$$, '42501', null, 'anon cannot search');

select * from finish();
rollback;
