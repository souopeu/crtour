begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vera' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);

insert into public.clientes (id, agencia_id, nome, whatsapp, consentimento_whatsapp) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana', '5511999990001', 'aceitou'),
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Bia', '5511999990002', 'nao_informado'),
  ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Caio', '5511999990003', 'pediu_saida');
insert into public.passeios (id, agencia_id, nome) values ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa');
-- Today = 2026-10-17 in the queries below
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos, situacao) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2026-10-19', 20, 1000, 'aberta'),   -- in 2 days
  ('a6000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2026-11-30', 20, 1000, 'aberta'),   -- far ahead
  ('a6000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2026-10-16', 20, 1000, 'encerrada'), -- yesterday
  ('a6000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2026-08-01', 20, 1000, 'encerrada'), -- long ago
  ('a6000000-0000-0000-0000-000000000005', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2026-10-18', 20, 1000, 'cancelada');
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, situacao, vendedor_id) values
  ('a7000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 1000, 'ativa', 'cccccccc-0000-0000-0000-000000000003'),
  ('a7000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 1, 1000, 'ativa', null),
  ('a7000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 1, 1000, 'ativa', null),
  ('a7000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 1, 1000, 'ativa', null),
  ('a7000000-0000-0000-0000-000000000005', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 1, 1000, 'ativa', null),
  ('a7000000-0000-0000-0000-000000000006', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 1, 1000, 'ativa', null),
  ('a7000000-0000-0000-0000-000000000007', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 1, 1000, 'cancelada', null);
insert into public.pagamentos (agencia_id, reserva_id, tipo, valor_centavos, data) values
  (current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000001', 'sinal', 400, '2026-10-01');

create function public.tmp_fila(p_hoje date) returns text language sql as $f$
  select coalesce(string_agg(right(reserva_id::text, 1) || ':' || tipo || ':' || saldo_centavos, ',' order by reserva_id, tipo), '')
  from public.fila_mensagens_passeio(p_hoje, 30) $f$;
grant execute on function public.tmp_fila(date) to authenticated;

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

-- R54/R55: confirmation for upcoming reservations, reminder N days before, review N days after (within a window)
select is(public.tmp_fila('2026-10-17'),
  '1:confirmacao:600,1:lembrete:600,2:confirmacao:1000,3:avaliacao:1000,6:confirmacao:1000',
  'confirmation (upcoming), reminder (2 days before), review (1 day after); cancelled reservation/departure and old trips out; balance carried');
select is((select dias_lembrete || '/' || dias_avaliacao from public.agencias), '2/1', 'defaults: reminder 2 days before, review 1 day after');

-- R56: who asked to leave is refused by the database; others are registered once
select throws_ok($$select public.registrar_mensagem_passeio('a7000000-0000-0000-0000-000000000006', 'confirmacao', 'oi')$$, 'CR009', null, 'who asked to leave never receives');
select lives_ok($$select public.registrar_mensagem_passeio('a7000000-0000-0000-0000-000000000001', 'confirmacao', 'Olá, Ana! Reserva confirmada.')$$, 'confirmation registered');
select is((select tipo || '|' || status || '|' || titulo from public.atividades where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 'whatsapp|feito|Mensagem do passeio (confirmação): Olá, Ana! Reserva confirmada.', 'it becomes a done WhatsApp activity');
select throws_ok($$select public.registrar_mensagem_passeio('a7000000-0000-0000-0000-000000000001', 'confirmacao', 'de novo')$$, 'CR010', null, 'each message once per reservation');
select is((select count(*) from public.atividades), 1::bigint, 'the repeat leaves no extra activity');
select lives_ok($$select public.registrar_mensagem_passeio('a7000000-0000-0000-0000-000000000002', 'confirmacao', 'oi')$$, 'consent not informed: service message allowed');
select is(public.tmp_fila('2026-10-17'), '1:lembrete:600,3:avaliacao:1000,6:confirmacao:1000', 'sent ones leave the queue');
select throws_ok($$select public.registrar_mensagem_passeio('a7000000-0000-0000-0000-000000000007', 'lembrete', 'oi')$$, 'CR006', null, 'cancelled reservation refused');
select throws_ok($$insert into public.mensagens_passeio_envios (agencia_id, reserva_id, tipo) values (current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000006', 'lembrete')$$, 'CR009', null, 'the rule holds writing the table directly');

-- Settings: only the owner
select is((select count(*) from public.agencias where id = current_setting('t.alfa')::uuid and dias_lembrete = 2), 1::bigint, 'seller sees the settings');
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
update public.agencias set dias_lembrete = 3, modelo_lembrete = 'Oi {nome}';
select is((select dias_lembrete || '|' || modelo_lembrete from public.agencias), '3|Oi {nome}', 'owner changes days and template');
select is(public.tmp_fila('2026-10-16'), '1:lembrete:600,3:confirmacao:1000,3:lembrete:1000,6:confirmacao:1000', 'reminder window follows the new days (3 before); on the trip day it is still upcoming; review not yet due');
select throws_ok($$update public.agencias set dias_lembrete = 0$$, '23514', null, 'days must be at least 1');
reset role;

select * from finish();
rollback;
