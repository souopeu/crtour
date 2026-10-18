begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.hoje', (now() at time zone 'America/Sao_Paulo')::date::text, true);
insert into public.formularios_publicos (agencia_id, codigo, ativo, titulo) values (current_setting('t.alfa')::uuid, 'AbCdEfGhIjKlMnOpQrStUvWx', true, 'Fale conosco');

-- R77: the public form keeps the click ids and the other tags
select lives_ok($$select public.enviar_formulario_publico('AbCdEfGhIjKlMnOpQrStUvWx', 'v1', 'Ana', '5511999990001', null, null, null, null, false, 'anuncio', 'google', 'Verao 2027',
  '{"utm_midia":"cpc","gclid":"Cj0KCQ-teste","fbclid":null}')$$, 'the form accepts the click ids');
select is((select gclid || '/' || utm_midia from public.negociacoes where utm_campanha = 'Verao 2027'), 'Cj0KCQ-teste/cpc', 'gclid and medium are stored on the deal');
select lives_ok($$select public.enviar_formulario_publico('AbCdEfGhIjKlMnOpQrStUvWx', 'v2', 'Bia', '5511999990002', null, null, null, null, false, 'site', null, null)$$,
  'old callers without the extra tags still work');
select throws_ok($$select public.enviar_formulario_publico('AbCdEfGhIjKlMnOpQrStUvWx', 'v3', 'Caio', '5511999990003', null, null, null, null, false, 'site', null, null, jsonb_build_object('gclid', repeat('x', 300)))$$,
  '22023', null, 'a click id that is too long is refused');

-- Ana's deal becomes a sale; one more lead of the same campaign stays open
update public.negociacoes set etapa = 'pago', valor_centavos = 300000 where utm_campanha = 'Verao 2027';
insert into public.negociacoes (agencia_id, cliente_id, titulo, utm_campanha)
  select current_setting('t.alfa')::uuid, cliente_id, 'Outro lead', ' verao 2027 ' from public.negociacoes where utm_campanha = 'Verao 2027';

-- R78: only the owner registers campaigns
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$insert into public.campanhas (agencia_id, nome, canal, utm_campanha, inicio) values (%L, 'Verão', 'google', 'verao 2027', current_date)$$, current_setting('t.alfa')),
  '42501', null, 'a seller cannot register a campaign');
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$insert into public.campanhas (agencia_id, nome, canal, utm_campanha, inicio, gasto_centavos) values (%L, 'Verão Google', 'google', 'verao 2027', current_date - 10, 100000)$$, current_setting('t.alfa')),
  'the owner registers a campaign');
select throws_ok(format($$insert into public.campanhas (agencia_id, nome, canal, utm_campanha, inicio) values (%L, 'X', 'meta', 'Com Maiuscula', current_date)$$, current_setting('t.alfa')),
  '23514', null, 'the key is stored lower case');
select throws_ok(format($$insert into public.campanhas (agencia_id, nome, canal, utm_campanha, inicio) values (%L, 'Repetida', 'meta', 'verao 2027', current_date)$$, current_setting('t.alfa')),
  '23505', null, 'one campaign per key');

-- R79: leads and sales per campaign, matched ignoring case and spaces
select is((select leads || '/' || vendas || '/' || valor_vendido_centavos || '/' || gasto_centavos from public.resultado_campanhas(current_setting('t.hoje')::date - 30, current_setting('t.hoje')::date) where chave = 'verao 2027'),
  '2/1/300000/100000', 'two leads, one sale, value and spend of the campaign');
select is((select leads from public.resultado_campanhas(current_setting('t.hoje')::date - 30, current_setting('t.hoje')::date) where chave is null), 1::bigint,
  'leads without a campaign come back as "not identified"');
select is((select leads from public.resultado_campanhas(current_setting('t.hoje')::date + 1, current_setting('t.hoje')::date + 2) where chave = 'verao 2027'), 0::bigint,
  'the period filters the leads but keeps the campaign');
reset role;

-- Another agency sees nothing of Alfa
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.campanhas), 0::bigint, 'another agency sees no campaigns');
select is((select count(*) from public.resultado_campanhas(current_setting('t.hoje')::date - 30, current_setting('t.hoje')::date)), 0::bigint, 'another agency gets an empty report');
reset role;

select * from finish();
rollback;
