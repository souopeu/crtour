begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
insert into public.clientes (id, agencia_id, nome, whatsapp, consentimento_whatsapp) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana', '5511999990001', 'aceitou'),
  ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Caio', '5511999990003', 'pediu_saida');
insert into public.canais_whatsapp (agencia_id, provedor, conta, modo) values (current_setting('t.alfa')::uuid, 'falso', 'num-alfa', 'envio');

-- R73: only the server (service key, after checking the provider's signature) writes what comes from WhatsApp
set local role service_role;
select lives_ok($$select public.whatsapp_receber('falso', 'num-alfa', 'w1', '5511999990001', 'Ana S', 'Oi, quero ir para Lisboa', '2026-10-18 10:00-03')$$, 'a message received from a known client');
select lives_ok($$select public.whatsapp_receber('falso', 'num-alfa', 'w1', '5511999990001', 'Ana S', 'Oi, quero ir para Lisboa', '2026-10-18 10:00-03')$$, 'the same notice again');
select lives_ok($$select public.whatsapp_receber('falso', 'num-alfa', 'w2', '5521988887777', 'Zeca', 'Bom dia', '2026-10-18 11:00-03')$$, 'a message from an unknown number');
select throws_ok($$select public.whatsapp_receber('falso', 'num-desconhecido', 'w3', '5511999990001', null, 'Oi', now())$$, 'P0002', null, 'a number that belongs to no agency is refused');
reset role;

select is((select count(*) from public.mensagens_whatsapp where id_externo = 'w1'), 1::bigint, 'a repeated notice is stored once');
select is((select direcao::text || '|' || situacao::text || '|' || c.nome from public.mensagens_whatsapp m join public.clientes c on c.id = m.cliente_id where m.id_externo = 'w1'),
  'recebida|recebida|Ana', 'linked to the client by the number');
select ok((select bool_or(titulo like 'WhatsApp recebido: Oi, quero ir para Lisboa%') from public.atividades where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 'R74: it enters the timeline as an activity');
select is((select nome || '|' || consentimento_whatsapp::text || '|' || origem::text from public.clientes where agencia_id = current_setting('t.alfa')::uuid and whatsapp = '5521988887777'),
  'Zeca|nao_informado|outro', 'an unknown number becomes a client without consent');

-- Sending (the future send action calls this after the provider accepted the message)
set local role service_role;
select lives_ok($$select public.whatsapp_registrar_envio('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'falso', 'e1', 'Olá, Ana!', null)$$, 'a member sends to a client');
select throws_ok($$select public.whatsapp_registrar_envio('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'falso', 'e2', 'Oi', null)$$, 'CR009', null, 'never to who asked to leave');
select throws_ok($$select public.whatsapp_registrar_envio('bbbbbbbb-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'falso', 'e3', 'Oi', null)$$, '42501', null, 'never on behalf of someone outside the agency');
select lives_ok($$select public.whatsapp_status('falso', 'e1', 'lida'), public.whatsapp_status('falso', 'e1', 'entregue')$$, 'delivery statuses, even out of order');
reset role;
select is((select situacao::text from public.mensagens_whatsapp where id_externo = 'e1'), 'lida', 'the status only moves forward');

-- Members read their agency's messages; nobody logged in can fake one
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.mensagens_whatsapp), 3::bigint, 'the agency sees its messages');
select throws_ok($$select public.whatsapp_receber('falso', 'num-alfa', 'w9', '5511999990001', null, 'falso', now())$$, '42501', null, 'a logged-in user cannot fake a received message');
reset role;

select * from finish();
rollback;
