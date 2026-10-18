begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Viagens Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);

-- The owner saves the form (still off): a random, unguessable code is created once
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_config('t.cod', public.salvar_formulario(false, 'Viaje com a gente', 'Conte seu sonho de viagem.'), true);
select ok(current_setting('t.cod') ~ '^[A-Za-z0-9_-]{24}$', 'R65: code has 24 url-safe random characters');
reset role;

-- Off: nothing is shown and nothing is accepted
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*) from public.formulario_publico(current_setting('t.cod'))), 0::bigint, 'a form that is off shows nothing');
select throws_ok(format($$select public.enviar_formulario_publico(%L, 'ip1', 'Maria', '5511999990001', null, null, null, null, false, null, null, null)$$, current_setting('t.cod')),
  'P0002', null, 'a form that is off refuses submissions');
reset role;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.salvar_formulario(true, 'Viaje com a gente', 'Conte seu sonho de viagem.'), current_setting('t.cod'), 'turning it on keeps the same code');
reset role;

set local role anon;
select is((select agencia || '|' || titulo from public.formulario_publico(current_setting('t.cod'))), 'Viagens Alfa|Viaje com a gente', 'on: shows only the agency name and its texts');
select is((select count(*) from public.formulario_publico('codigo-errado-0000000000')), 0::bigint, 'a wrong code shows nothing');
select lives_ok(format($$select public.enviar_formulario_publico(%L, 'ip1', 'Maria', '5511999990001', 'Lisboa', 2, '2027-03-10', 'Quero ir em março', true, 'instagram', 'ig', 'verao')$$, current_setting('t.cod')),
  'R67: a visitor submits the form');
select throws_ok($$select count(*) from public.formularios_publicos$$, '42501', null, 'visitors cannot read the forms table');
reset role;

-- What the submission created (R66, R67)
select is((select origem::text || '|' || consentimento_whatsapp::text || '|' || array_to_string(destinos_interesse, ',') || '|' || qtd_pessoas
  from public.clientes where agencia_id = current_setting('t.alfa')::uuid and whatsapp = '5511999990001'), 'instagram|aceitou|Lisboa|2', 'new client with origin, consent, destination and people');
select is((select etapa::text || '|' || titulo || '|' || utm_fonte || '|' || utm_campanha || '|' || data_fechamento_esperada from public.negociacoes where agencia_id = current_setting('t.alfa')::uuid),
  'interessado|Formulário: Lisboa|ig|verao|2027-03-10', 'deal in Interessado with the campaign');
select is((select tipo::text || '|' || cliente_nome from public.avisos where agencia_id = current_setting('t.alfa')::uuid), 'lead_formulario|Maria', 'the owner is notified');
select ok((select texto like '%Quero ir em março%' from public.anotacoes where agencia_id = current_setting('t.alfa')::uuid), 'the message is kept as a note');

-- Same WhatsApp again: no duplicate client, nothing overwritten, a new deal and a note
set local role anon;
select lives_ok(format($$select public.enviar_formulario_publico(%L, 'ip1', 'Maria Errada', '5511999990001', null, null, null, 'De novo', false, 'tv', null, null)$$, current_setting('t.cod')),
  'second submission from the same number');
reset role;
select is((select count(*) || '|' || min(nome) || '|' || min(consentimento_whatsapp::text) from public.clientes where agencia_id = current_setting('t.alfa')::uuid and whatsapp = '5511999990001'), '1|Maria|aceitou',
  'the existing client is reused and nothing is overwritten');
select is((select count(*) from public.negociacoes where agencia_id = current_setting('t.alfa')::uuid), 2::bigint, 'a new deal for the new contact');
select ok((select bool_or(texto like '%Maria Errada%') from public.anotacoes where agencia_id = current_setting('t.alfa')::uuid), 'the name typed this time goes into the note');

-- Unknown origin falls back to site; invalid input is refused
set local role anon;
select lives_ok(format($$select public.enviar_formulario_publico(%L, 'ip1', 'José', '5511999990002', null, null, null, null, false, 'tv', null, null)$$, current_setting('t.cod')), 'no valid origin');
select throws_ok(format($$select public.enviar_formulario_publico(%L, 'ip2', 'Zé', 'abc', null, null, null, null, false, null, null, null)$$, current_setting('t.cod')),
  '22023', null, 'an invalid WhatsApp is refused');

-- R68: 50 submissions in a row are stopped (5 per visitor per hour, 30 per agency per hour)
select throws_ok(format($$select public.enviar_formulario_publico(%L, 'ip1', 'Robô', '55119999' || lpad(g::text, 5, '0'), null, null, null, null, false, null, null, null) from generate_series(1, 50) g$$, current_setting('t.cod')),
  'CR016', null, 'the same visitor is stopped after a few submissions');
select throws_ok(format($$select public.enviar_formulario_publico(%L, 'ip-' || g, 'Robô', '55118888' || lpad(g::text, 5, '0'), null, null, null, null, false, null, null, null) from generate_series(1, 50) g$$, current_setting('t.cod')),
  'CR016', null, 'the agency is protected even when the visitors change');
reset role;

select * from finish();
rollback;
