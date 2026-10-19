begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Spec 21 (W1): official WhatsApp in coexistence, read only. R110 channel mode, R112 echoes from the phone,
-- R113 history import, R114 no sending in read-only mode.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
insert into public.clientes (id, agencia_id, nome, whatsapp, consentimento_whatsapp) values
  ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Caio Reis', '5511999990003', 'aceitou');
insert into public.canais_whatsapp (agencia_id, provedor, conta, waba_id, numero) values
  (current_setting('t.alfa')::uuid, 'meta', 'PN-alfa', 'WABA-alfa', '5511900000000');

select is((select modo::text || '|' || situacao::text from public.canais_whatsapp where conta = 'PN-alfa'), 'leitura|conectado', 'R110: a new channel is read only and connected');

-- R112: what the agency sends from the phone
set local role service_role;
select public.whatsapp_receber('meta', 'PN-alfa', 'in-1', '5511999990001', 'Ana', 'Oi, tem vaga?', '2026-10-19 09:00-03');
select public.whatsapp_registrar_eco('meta', 'PN-alfa', 'eco-1', '5511999990001', 'Tem sim!', '2026-10-19 09:05-03');
select public.whatsapp_registrar_eco('meta', 'PN-alfa', 'eco-1', '5511999990001', 'Tem sim!', '2026-10-19 09:05-03');
reset role;
select is((select direcao::text || '|' || pelo_celular || '|' || coalesce(enviado_por::text, 'ninguem') from public.mensagens_whatsapp where provedor = 'meta' and id_externo = 'eco-1'),
  'enviada|true|ninguem', 'an echo is a sent message, from the phone, by no crTOUR person');
select is((select count(*) from public.mensagens_whatsapp where provedor = 'meta' and id_externo = 'eco-1'), 1::bigint, 'a repeated echo is stored once');
select is((select nao_lidas || '|' || ultima_previa from public.conversas c join public.clientes cl on cl.id = c.cliente_id where cl.whatsapp = '5511999990001' and cl.agencia_id = current_setting('t.alfa')::uuid),
  '1|Tem sim!', 'it updates the preview and does not count as unread');
set local role service_role;
select public.whatsapp_registrar_eco('meta', 'PN-alfa', 'eco-2', '5511988887777', 'Bom dia! Vi que você pediu um orçamento', now());
reset role;
select is((select nome from public.clientes where whatsapp = '5511988887777' and agencia_id = current_setting('t.alfa')::uuid), 'Contato do WhatsApp', 'the agency writing first to a new number creates the client');

-- R114: read only refuses sending, on the database too
select throws_ok($$select public.whatsapp_registrar_envio('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'meta', 'out-1', 'Oi', null)$$,
  'CR010', null, 'no sending from crTOUR in read-only mode');
update public.canais_whatsapp set modo = 'envio' where conta = 'PN-alfa';
select lives_ok($$select public.whatsapp_registrar_envio('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'meta', 'out-1', 'Oi', null)$$,
  'with sending on, it works as before');

-- R113: history import, read, one summary activity per client, no duplicates, names never overwritten
set local role service_role;
select public.whatsapp_importar_historico('meta', 'PN-alfa', '[
  {"numero": "5511999990002", "nome": "Bia Lima", "mensagens": [
    {"id": "h1", "do_cliente": true, "texto": "Quero ir para Lisboa", "em": "2026-09-01T10:00:00-03:00"},
    {"id": "h2", "do_cliente": false, "texto": "Temos saída em maio", "em": "2026-09-01T10:10:00-03:00"}]},
  {"numero": "5511999990003", "nome": "Caio R.", "mensagens": [
    {"id": "h3", "do_cliente": true, "texto": "Obrigado!", "em": "2026-08-20T08:00:00-03:00"}]}
]');
select public.whatsapp_importar_historico('meta', 'PN-alfa', '[
  {"numero": "5511999990002", "nome": "Bia Lima", "mensagens": [{"id": "h1", "do_cliente": true, "texto": "Quero ir para Lisboa", "em": "2026-09-01T10:00:00-03:00"}]}
]');
reset role;
select is((select count(*) from public.mensagens_whatsapp where provedor = 'meta' and id_externo in ('h1', 'h2', 'h3')), 3::bigint, 'history messages are stored once');
select is((select string_agg(direcao::text, ',' order by criada_em) from public.mensagens_whatsapp where provedor = 'meta' and id_externo in ('h1', 'h2')), 'recebida,enviada',
  'direction comes from who wrote');
select is((select nao_lidas || '|' || ultima_previa || '|' || (ultima_recebida_em = '2026-09-01T10:00:00-03:00'::timestamptz)
           from public.conversas c join public.clientes cl on cl.id = c.cliente_id where cl.whatsapp = '5511999990002' and cl.agencia_id = current_setting('t.alfa')::uuid),
  '0|Temos saída em maio|true', 'imported history is already read, with the last message as preview');
select is((select count(*) || '|' || min(titulo) from public.atividades a join public.clientes cl on cl.id = a.cliente_id where cl.whatsapp = '5511999990002' and cl.agencia_id = current_setting('t.alfa')::uuid),
  '1|Histórico do WhatsApp importado: 2 mensagens', 'one summary activity per client, none for a repeated import');
select is((select nome from public.clientes where whatsapp = '5511999990002' and agencia_id = current_setting('t.alfa')::uuid), 'Bia Lima', 'a new client takes the WhatsApp name');
select is((select nome from public.clientes where id = 'a1000000-0000-0000-0000-000000000003'), 'Caio Reis', 'an existing name is never overwritten');
set local role service_role;
select throws_ok($$select public.whatsapp_importar_historico('meta', 'PN-desconhecido', '[]')$$, 'P0002', null, 'a number that belongs to no agency is refused');
reset role;

-- Only the server writes; another agency sees nothing
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.whatsapp_registrar_eco('meta', 'PN-alfa', 'eco-x', '5511999990001', 'x', now())$$, '42501', null, 'a member cannot fake an echo');
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.canais_whatsapp), 0::bigint, 'another agency does not see the channel');
reset role;

select * from finish();
rollback;
