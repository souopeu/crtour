begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);

-- Today = 2026-10-18 in the queries below
insert into public.clientes (id, agencia_id, nome, whatsapp, consentimento_whatsapp, aniversario) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana', '5511999990001', 'aceitou', '1990-10-18'),        -- today
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Bia', '5511999990002', 'nao_informado', '1990-10-18'),  -- today, no consent
  ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Caio', '5511999990003', 'pediu_saida', '1990-10-18'),   -- asked to leave
  ('a1000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'Dani', '5511999990004', 'aceitou', '1985-10-16'),       -- 2 days ago
  ('a1000000-0000-0000-0000-000000000005', current_setting('t.alfa')::uuid, 'Eva', '5511999990005', 'aceitou', '1985-10-13'),        -- 5 days ago
  ('a1000000-0000-0000-0000-000000000006', current_setting('t.alfa')::uuid, 'Fabi', '5511999990006', 'aceitou', '2000-02-29'),       -- leap day
  ('a1000000-0000-0000-0000-000000000007', current_setting('t.alfa')::uuid, 'Gil', '5511999990007', 'aceitou', '1990-12-31');        -- end of year
insert into public.passeios (id, agencia_id, nome) values ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos, situacao) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2025-10-18', 20, 1000, 'encerrada'); -- one year ago
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, situacao) values
  ('a7000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 1000, 'ativa'),
  ('a7000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 1, 1000, 'ativa'),
  ('a7000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', 1, 1000, 'cancelada');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- R71: birthdays, only with consent, from the day until 3 days later
select is((select array_agg(c.nome order by f.dia, c.nome) from public.fila_aniversarios('2026-10-18', 3) f join public.clientes c on c.id = f.cliente_id),
  array['Dani', 'Ana'], 'birthdays today and 2 days ago, only for who accepted messages');
select is((select count(*) from public.fila_aniversarios('2027-02-28', 0) f where f.cliente_id = 'a1000000-0000-0000-0000-000000000006'), 1::bigint, 'leap-day birthday falls on 28/02 in other years');
select is((select ano from public.fila_aniversarios('2027-01-01', 3) f where f.cliente_id = 'a1000000-0000-0000-0000-000000000007'), 2026, 'a 31/12 birthday still shows on 01/01, counted for last year');
select lives_ok($$select public.registrar_aniversario('a1000000-0000-0000-0000-000000000001', 2026, 'Feliz aniversário, Ana!')$$, 'sending a birthday message');
select ok((select bool_or(titulo like 'Aniversário: Feliz aniversário, Ana!%' and status = 'feito') from public.atividades where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 'it becomes a done WhatsApp activity');
select throws_ok($$select public.registrar_aniversario('a1000000-0000-0000-0000-000000000001', 2026, 'De novo')$$, 'CR010', null, 'once per person per year');
select is((select count(*) from public.fila_aniversarios('2026-10-18', 3) f where f.cliente_id = 'a1000000-0000-0000-0000-000000000001'), 0::bigint, 'and it leaves the queue');
select throws_ok($$select public.registrar_aniversario('a1000000-0000-0000-0000-000000000002', 2026, 'Oi')$$, 'CR017', null, 'never without consent');

-- R72: one year since the trip, per reservation, only with consent and for reservations not cancelled
select is((select array_agg(reserva_id) from public.fila_mensagens_passeio('2026-10-18', 30) where tipo = 'um_ano'),
  array['a7000000-0000-0000-0000-000000000001'::uuid], 'one year since the trip, only for who accepted messages');
select is((select count(*) from public.fila_mensagens_passeio('2026-11-30', 30) where tipo = 'um_ano'), 0::bigint, 'it leaves the queue after the window');
select is((select count(*) from public.fila_mensagens_passeio('2026-10-17', 30) where tipo = 'um_ano'), 0::bigint, 'and does not show before the date');
select lives_ok($$select public.registrar_mensagem_passeio('a7000000-0000-0000-0000-000000000001', 'um_ano', 'Faz um ano!')$$, 'sending the one-year message');
select ok((select bool_or(titulo like 'Mensagem do passeio (1 ano da viagem):%') from public.atividades where cliente_id = 'a1000000-0000-0000-0000-000000000001'), 'logged with its own label');
select throws_ok($$select public.registrar_mensagem_passeio('a7000000-0000-0000-0000-000000000002', 'um_ano', 'Oi')$$, 'CR017', null, 'never without consent');
reset role;

select * from finish();
rollback;
