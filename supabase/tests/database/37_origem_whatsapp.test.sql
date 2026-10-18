begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.hoje', (now() at time zone 'America/Sao_Paulo')::date::text, true);
insert into public.canais_whatsapp (agencia_id, provedor, conta) values (current_setting('t.alfa')::uuid, 'falso', 'num-1');

-- R81: only the owner sets the WhatsApp link
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$insert into public.links_whatsapp (agencia_id, whatsapp) values (%L, '5511999990000')$$, current_setting('t.alfa')), '42501', null, 'a seller cannot set the link');
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$insert into public.links_whatsapp (agencia_id, whatsapp) values (%L, '5511999990000')$$, current_setting('t.alfa')), 'the owner sets the link');
reset role;
select set_config('t.link', (select codigo from public.links_whatsapp where agencia_id = current_setting('t.alfa')::uuid), true);

-- R81: a visitor's click gets a short code, the number and the message
set local role anon;
select set_config('t.cod', (select codigo from public.registrar_clique_anuncio(current_setting('t.link'), 'visitante-1', 'Cj0-gclid', 'google', 'cpc', 'Verao 2027', null, null)), true);
select ok(current_setting('t.cod') ~ '^[A-HJ-NP-Z2-9]{5}$', 'a readable 5-character code');
select is((select whatsapp from public.registrar_clique_anuncio(current_setting('t.link'), 'visitante-2', null, null, null, null, null, null)), '5511999990000', 'the agency number comes back');
select throws_ok($$select * from public.registrar_clique_anuncio('codigo-errado-00000000000', 'v', null, null, null, null, null, null)$$, 'P0002', null, 'an unknown link is refused');
select throws_ok($$select count(*) from public.cliques_anuncio$$, '42501', null, 'visitors cannot read the clicks');
reset role;
set local role anon;
select throws_ok($$select (public.registrar_clique_anuncio(current_setting('t.link'), 'repete', null, null, null, null, null, null)).codigo from generate_series(1, 11)$$,
  'CR016', null, 'too many clicks from one visitor are refused');
reset role;

-- R82: the message with the code links the new client to the Google click
select public.whatsapp_receber('falso', 'num-1', 'w1', '5511988880001', 'Bruno', 'Olá! Quero saber dos passeios (cód. ' || current_setting('t.cod') || ')', now());
select is((select canal::text || '/' || campanha || '/' || clique_id from public.origens_contato o join public.clientes c on c.id = o.cliente_id where c.whatsapp = '5511988880001'),
  'google/verao 2027/Cj0-gclid', 'Google click: channel, campaign and gclid on the client');
select is((select origem::text from public.clientes where whatsapp = '5511988880001'), 'anuncio', 'a client created by the ad gets origin "anúncio"');
select public.whatsapp_receber('falso', 'num-1', 'w2', '5511988880002', 'Carla', 'cod ' || current_setting('t.cod'), now());
select is((select count(*) from public.origens_contato o join public.clientes c on c.id = o.cliente_id where c.whatsapp = '5511988880002'), 0::bigint, 'a code works only once');

-- R82: Meta ad data that comes with the message
select public.whatsapp_receber('falso', 'num-1', 'w3', '5511988880003', 'Dani', 'Oi', now(),
  '{"tipo":"anuncio","anuncio_id":"120200","titulo":"Gramado no inverno","url":"https://fb.me/x","clique_id":"ctwa-1"}');
select is((select canal::text || '/' || anuncio_id || '/' || anuncio_titulo from public.origens_contato o join public.clientes c on c.id = o.cliente_id where c.whatsapp = '5511988880003'),
  'meta/120200/Gramado no inverno', 'Meta ad: channel, ad and title on the client');
select public.whatsapp_receber('falso', 'num-1', 'w4', '5511988880004', 'Edu', 'Oi, sem código', now());
select is((select count(*) from public.origens_contato o join public.clientes c on c.id = o.cliente_id where c.whatsapp = '5511988880004'), 0::bigint, 'no ad data and no code: nothing is guessed');

-- R83: campaigns built from what arrived; Dani buys
insert into public.negociacoes (agencia_id, cliente_id, titulo, etapa, valor_centavos)
  select current_setting('t.alfa')::uuid, id, 'Gramado da Dani', 'pago', 500000 from public.clientes where whatsapp = '5511988880003';
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select canal || '/' || titulo || '/' || leads || '/' || vendas || '/' || valor_vendido_centavos from public.resultado_campanhas(current_setting('t.hoje')::date - 1, current_setting('t.hoje')::date) where chave = 'anuncio:120200'),
  'meta/Gramado no inverno/1/1/500000', 'the Meta ad shows up by itself with its lead and sale');
select is((select canal || '/' || leads from public.resultado_campanhas(current_setting('t.hoje')::date - 1, current_setting('t.hoje')::date) where chave = 'verao 2027'),
  'google/1', 'the Google campaign shows up by itself');
select is((select leads from public.resultado_campanhas(current_setting('t.hoje')::date - 1, current_setting('t.hoje')::date) where chave is null), 2::bigint,
  'clients with no known arrival are "not identified"');
reset role;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.v_origens_cliente), 0::bigint, 'another agency sees no arrivals');
reset role;

select * from finish();
rollback;
