begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- Spec 19, R100–R101: one conversation per client and channel, who handles it, unread count and its timeline events.
-- Alfa: owner A, sellers C and D. Beta: owner B.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}'),
  ('dddddddd-0000-0000-0000-000000000004', 'd@test.dev', '{}');
delete from public.agencias where id in (select agencia_id from public.membros where user_id in ('cccccccc-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000004'));
insert into public.membros (user_id, agencia_id, papel, nome)
  select u, agencia_id, 'vendedor', n from public.membros,
    (values ('cccccccc-0000-0000-0000-000000000003'::uuid, 'Vendedora C'), ('dddddddd-0000-0000-0000-000000000004'::uuid, 'Vendedora D')) v(u, n)
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
insert into public.clientes (id, agencia_id, nome, whatsapp, consentimento_whatsapp) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana', '5511999990001', 'aceitou');
insert into public.etiquetas (id, agencia_id, nome) values ('e1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Europa');
insert into public.canais_whatsapp (agencia_id, provedor, conta, modo) values (current_setting('t.alfa')::uuid, 'falso', 'num-alfa', 'envio');

create function pg_temp.como(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.conversa() returns uuid language sql as $$
  select id from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001';
$$;

-- Arrival and unread count (server side, as the provider notice does)
set local role service_role;
select public.whatsapp_receber('falso', 'num-alfa', 'w1', '5511999990001', 'Ana', 'Oi, quero ir para Lisboa', '2026-10-18 10:00-03');
select public.whatsapp_receber('falso', 'num-alfa', 'w1', '5511999990001', 'Ana', 'Oi, quero ir para Lisboa', '2026-10-18 10:00-03');
reset role;
select is((select canal::text || '|' || situacao::text || '|' || coalesce(responsavel_id::text, 'novo') || '|' || nao_lidas || '|' || ultima_previa from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'),
  'whatsapp|aberta|novo|1|Oi, quero ir para Lisboa', 'a received message opens a new conversation with one unread');
set local role service_role;
select public.whatsapp_receber('falso', 'num-alfa', 'w2', '5511999990001', 'Ana', repeat('a', 300), '2026-10-18 10:05-03');
select public.whatsapp_registrar_envio('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'falso', 'e1', 'Olá, Ana!', null);
reset role;
select is((select nao_lidas from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 2, 'a repeated notice does not count twice; a new one does');
select is((select ultima_previa from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 'Olá, Ana!', 'a sent message updates the preview but not the unread count');
select ok((select ultima_mensagem_em > ultima_recebida_em from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 'last message and last received are kept apart (24 h window)');
select is((select count(*) from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 1::bigint, 'one conversation per client and channel');

-- Direct writes are refused: only the functions change conversations and events
select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(format($$update public.conversas set responsavel_id = 'cccccccc-0000-0000-0000-000000000003' where id = %L$$, pg_temp.conversa()), '42501', null, 'a member cannot change a conversation directly');
select throws_ok(format($$insert into public.eventos_conversa (agencia_id, conversa_id, tipo, ator) values (%L, %L, 'assumiu', 'pessoa')$$, current_setting('t.alfa'), pg_temp.conversa()),
  '42501', null, 'a member cannot write an event directly');

-- A new conversation is visible to every member of the agency, and to no one else
select is((select count(*) from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 1::bigint, 'a seller sees a new conversation');
select is((select count(*) from public.mensagens_whatsapp), 3::bigint, 'and its messages');
reset role;
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
set local role authenticated;
select is((select count(*) from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 0::bigint, 'another agency sees no conversation');
select throws_ok(format($$select public.conversa_assumir(%L)$$, pg_temp.conversa()), 'P0002', null, 'another agency cannot take it');
reset role;

-- C takes it: it leaves "Novos" for everyone else
select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
set local role authenticated;
select lives_ok(format($$select public.conversa_assumir(%L)$$, pg_temp.conversa()), 'a seller takes a new conversation');
reset role;
select is((select responsavel_id from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 'cccccccc-0000-0000-0000-000000000003'::uuid, 'she is now responsible');
select is((select tipo::text || '|' || ator::text || '|' || autor_id::text from public.eventos_conversa where conversa_id = pg_temp.conversa() and tipo = 'assumiu'),
  'assumiu|pessoa|cccccccc-0000-0000-0000-000000000003', 'taking it is an event with its author');

select pg_temp.como('dddddddd-0000-0000-0000-000000000004');
set local role authenticated;
select is((select count(*) from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 0::bigint, 'another seller no longer sees it');
select is((select count(*) from public.mensagens_whatsapp), 0::bigint, 'nor its messages');
select is((select count(*) from public.eventos_conversa), 0::bigint, 'nor its events');
select throws_ok(format($$select public.conversa_assumir(%L)$$, pg_temp.conversa()), 'P0002', null, 'nor can she take it');
reset role;

-- C hands it to D; not to someone outside the agency
select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(format($$select public.conversa_transferir(%L, 'bbbbbbbb-0000-0000-0000-000000000002')$$, pg_temp.conversa()), '22023', null, 'never to someone outside the agency');
select lives_ok(format($$select public.conversa_transferir(%L, 'dddddddd-0000-0000-0000-000000000004')$$, pg_temp.conversa()), 'the responsible seller hands it over');
select is((select count(*) from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 0::bigint, 'after handing it over she no longer sees it');
reset role;
select is((select para_id from public.eventos_conversa where conversa_id = pg_temp.conversa() and tipo = 'transferiu'), 'dddddddd-0000-0000-0000-000000000004'::uuid, 'the event says to whom');

-- D reads it; the owner archives it; a new message reopens it
select pg_temp.como('dddddddd-0000-0000-0000-000000000004');
set local role authenticated;
select public.conversa_marcar_lida(pg_temp.conversa());
reset role;
select is((select nao_lidas from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 0, 'opening it clears the unread count');
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select is((select count(*) from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 1::bigint, 'the owner sees conversations of everyone');
select lives_ok(format($$select public.conversa_arquivar(%L)$$, pg_temp.conversa()), 'the owner archives it');
reset role;
select is((select situacao::text from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 'arquivada', 'archived');
set local role service_role;
select public.whatsapp_receber('falso', 'num-alfa', 'w3', '5511999990001', 'Ana', 'Voltei!', now(),
  '{"tipo":"anuncio","anuncio_id":"120200","titulo":"Lisboa em maio","url":null,"clique_id":null}');
reset role;
select is((select situacao::text || '|' || nao_lidas || '|' || responsavel_id::text from public.conversas where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 'aberta|1|dddddddd-0000-0000-0000-000000000004',
  'a new message reopens it and keeps who handles it');
select is((select ator::text from public.eventos_conversa where conversa_id = pg_temp.conversa() and tipo = 'reabriu'), 'sistema', 'reopening is a system event');
select is((select detalhe from public.eventos_conversa where conversa_id = pg_temp.conversa() and tipo = 'chegou_por_anuncio'), 'Lisboa em maio', 'an ad arrival is an event with the ad title');

-- Tags on the client show up in the conversation timeline
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
insert into public.cliente_etiquetas (cliente_id, etiqueta_id, agencia_id) values ('a1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid);
delete from public.cliente_etiquetas where cliente_id = 'a1000000-0000-0000-0000-000000000001';
reset role;
select is((select string_agg(tipo::text || ':' || detalhe, ',' order by criado_em, tipo) from public.eventos_conversa where conversa_id = pg_temp.conversa() and tipo in ('etiqueta_adicionada', 'etiqueta_removida')),
  'etiqueta_adicionada:Europa,etiqueta_removida:Europa', 'adding and removing a tag are events');

select * from finish();
rollback;
