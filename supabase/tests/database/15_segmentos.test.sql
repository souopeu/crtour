begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

-- Clients with different traits (agency Alfa) and one look-alike in Beta
insert into public.clientes (id, agencia_id, nome, whatsapp, cidade, aniversario, origem, destinos_interesse, passaporte_validade, consentimento_whatsapp) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana Lisboa', '5511999990001', 'São Paulo', '1990-03-10', 'instagram', '{"Lisboa","Porto"}', current_date + 60, 'aceitou'),
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Bia Praia', '5511999990002', 'Campinas', '1985-07-02', 'indicacao', '{"Maceió"}', current_date + 400, 'nao_informado'),
  ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Caio Saiu', '5511999990003', 'são paulo', '1992-03-21', 'instagram', '{"lisboa"}', null, 'pediu_saida'),
  ('a1000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'Duda Velha', '5511999990004', 'Santos', null, null, '{}', current_date - 10, 'aceitou'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Beta Lisboa', '5511999990009', 'São Paulo', '1990-03-10', 'instagram', '{"Lisboa"}', null, 'aceitou');
insert into public.etiquetas (id, agencia_id, nome) values ('a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'VIP');
insert into public.cliente_etiquetas (cliente_id, etiqueta_id, agencia_id) values
  ('a1000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid);
update public.clientes set criado_em = now() - interval '90 days' where id in ('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004');
insert into public.negociacoes (agencia_id, cliente_id, titulo, etapa, motivo_perda) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000004', 'Cancún', 'perdido', 'achou_caro');

create function public.tmp_nomes(p jsonb) returns text language sql as $f$
  select coalesce(string_agg(nome, ',' order by nome), '') from public.clientes_do_segmento(p) $f$;
grant execute on function public.tmp_nomes(jsonb) to authenticated;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- R36: each criterion, combined with AND, only within the agency
select is(public.tmp_nomes('{}'), 'Ana Lisboa,Bia Praia,Caio Saiu,Duda Velha', 'no criteria: every client of the agency (never another agency)');
select is(public.tmp_nomes('{"destino":"LISBOA"}'), 'Ana Lisboa,Caio Saiu', 'destination, ignoring case');
select is(public.tmp_nomes('{"destino":"lis%"}'), '', 'destination text is literal, not a pattern');
select is(public.tmp_nomes('{"cidade":"são paulo"}'), 'Ana Lisboa,Caio Saiu', 'city, ignoring case');
select is(public.tmp_nomes('{"origem":"instagram"}'), 'Ana Lisboa,Caio Saiu', 'lead source');
select is(public.tmp_nomes('{"etiqueta":"a2000000-0000-0000-0000-000000000001"}'), 'Bia Praia', 'tag');
select is(public.tmp_nomes('{"aniversarioMes":3}'), 'Ana Lisboa,Caio Saiu', 'birthdays in the month');
select is(public.tmp_nomes('{"semContatoDias":30}'), 'Caio Saiu,Duda Velha', 'no contact for 30 days (counted from registration when never contacted)');
select is(public.tmp_nomes('{"motivoPerda":"achou_caro"}'), 'Duda Velha', 'lost deals by reason');
select is(public.tmp_nomes('{"passaporteMeses":6}'), 'Ana Lisboa,Duda Velha', 'passport expiring within 6 months (or already expired)');
select is(public.tmp_nomes('{"destino":"lisboa","origem":"instagram","aniversarioMes":3}'), 'Ana Lisboa,Caio Saiu', 'criteria combine with AND');
select is((select destino from public.clientes_do_segmento('{"destino":"porto"}')), 'Porto', '{destino} uses the matching destination');
select is((select destino from public.clientes_do_segmento('{}') where nome = 'Ana Lisboa'), 'Lisboa', 'without a destination filter, the first one');

-- Saving a segment: author stamped, criteria must be an object
insert into public.segmentos (agencia_id, nome, criterios, mensagem) values
  (current_setting('t.alfa')::uuid, 'Lisboa', '{"destino":"lisboa"}', 'Oi {nome}, novidades de {destino}!');
select set_config('t.seg', (select id::text from public.segmentos), true);
select is((select criado_por from public.segmentos), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'author stamped');
select throws_ok($$insert into public.segmentos (agencia_id, nome, criterios) values (current_setting('t.alfa')::uuid, 'X', '[1]')$$, '23514', null, 'criteria must be a JSON object');
select throws_ok($$insert into public.segmentos (agencia_id, nome, criado_por) values (current_setting('t.alfa')::uuid, 'Y', 'bbbbbbbb-0000-0000-0000-000000000002')$$, '42501', null, 'author cannot be spoofed');
select throws_ok($$insert into public.segmentos (agencia_id, nome) values (current_setting('t.beta')::uuid, 'Z')$$, '42501', null, 'cannot create a segment in another agency');

-- R37/R38: sending is only for consent "aceitou", becomes a done activity, and never repeats in the round
select throws_ok($$select public.registrar_envio_segmento(current_setting('t.seg')::uuid, 'a1000000-0000-0000-0000-000000000003', 'oi')$$, 'CR009', null, 'who asked to leave is refused');
select throws_ok($$select public.registrar_envio_segmento(current_setting('t.seg')::uuid, 'a1000000-0000-0000-0000-000000000002', 'oi')$$, 'CR009', null, 'consent not informed is refused');
select throws_ok($$insert into public.segmento_envios (agencia_id, segmento_id, cliente_id) values (current_setting('t.alfa')::uuid, current_setting('t.seg')::uuid, 'a1000000-0000-0000-0000-000000000002')$$, 'CR009', null, 'the rule holds even writing the table directly');
select is((select count(*) from public.atividades), 0::bigint, 'refused sends leave no activity behind');

select lives_ok($$select public.registrar_envio_segmento(current_setting('t.seg')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Oi Ana, novidades de Lisboa!')$$, 'consent "aceitou": send registered');
select is((select tipo || '|' || status || '|' || titulo from public.atividades), 'whatsapp|feito|Remarketing (Lisboa): Oi Ana, novidades de Lisboa!', 'it becomes a done WhatsApp activity');
select isnt((select ultima_interacao_em from public.clientes where id = 'a1000000-0000-0000-0000-000000000001'), null, 'and updates the last interaction');
select is((select rodada || '|' || (atividade_id is not null)::text from public.segmento_envios), '1|true', 'marked as called in round 1');
select throws_ok($$select public.registrar_envio_segmento(current_setting('t.seg')::uuid, 'a1000000-0000-0000-0000-000000000001', 'de novo')$$, 'CR010', null, 'the same client is not called twice in the round');
select is((select count(*) from public.atividades), 1::bigint, 'the repeated attempt leaves no extra activity');

update public.segmentos set rodada = rodada + 1;
select lives_ok($$select public.registrar_envio_segmento(current_setting('t.seg')::uuid, 'a1000000-0000-0000-0000-000000000001', 'rodada 2')$$, 'a new round allows calling again');
select throws_ok($$delete from public.segmento_envios$$, '42501', null, 'sends cannot be deleted (history)');

reset role;
select is((select count(*) from public.segmentos where agencia_id = current_setting('t.beta')::uuid), 0::bigint, 'other agency untouched');

select * from finish();
rollback;
