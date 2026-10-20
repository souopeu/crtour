begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- A owns Alfa, C sells in Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000441', 'lem-a@test.dev', '{"agencia_nome":"Alfa lembretes"}'),
  ('bbbbbbbb-0000-0000-0000-000000000442', 'lem-b@test.dev', '{"agencia_nome":"Beta lembretes"}'),
  ('cccccccc-0000-0000-0000-000000000443', 'lem-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000443');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000443', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000441';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000441'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000441', current_setting('t.alfa')::uuid, 'Ana Lembrete');
-- "Now" is 08/03/2027 15:00 in Brazil.
insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status, responsavel_id, criado_por) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000441', 'ligacao', 'Ligar agora', '2027-03-08 14:30-03', 'pendente', 'cccccccc-0000-0000-0000-000000000443', 'aaaaaaaa-0000-0000-0000-000000000441'),
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000441', 'tarefa', 'Mandar roteiro', '2027-03-08 13:00-03', 'pendente', null, 'aaaaaaaa-0000-0000-0000-000000000441'),
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000441', 'tarefa', 'Velha', '2027-03-05 10:00-03', 'pendente', null, 'aaaaaaaa-0000-0000-0000-000000000441'),
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000441', 'whatsapp', 'Já feita', '2027-03-08 14:50-03', 'feito', null, 'aaaaaaaa-0000-0000-0000-000000000441');

insert into public.passeios (id, agencia_id, nome) values ('a2000000-0000-0000-0000-000000000441', current_setting('t.alfa')::uuid, 'Serra lembrete');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos, situacao) values
  ('a3000000-0000-0000-0000-000000000441', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000441', '2027-03-10', 10, 100000, 'aberta');
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, vencimento_saldo, vendedor_id) values
  ('a4000000-0000-0000-0000-000000000441', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000441', 'a1000000-0000-0000-0000-000000000441', 1, 100000, '2027-03-08', 'cccccccc-0000-0000-0000-000000000443');

-- The clock runs for every agency (the local database keeps other tests' data), so count only Alfa.
select public.gerar_lembretes('2027-03-08 15:00-03');
select is((select count(*) from public.avisos where agencia_id = current_setting('t.alfa')::uuid), 6::bigint, 'now + late + 2 billing + 2 departure reminders');
select public.gerar_lembretes('2027-03-08 15:05-03');
select is((select count(*) from public.avisos where agencia_id = current_setting('t.alfa')::uuid), 6::bigint, 'running again adds nothing');
select is((select para_user_id from public.avisos where tipo = 'atividade_agora' and agencia_id = current_setting('t.alfa')::uuid), 'cccccccc-0000-0000-0000-000000000443'::uuid, 'due-now goes to the person responsible');
select is((select para_user_id from public.avisos where tipo = 'atividade_atrasada' and agencia_id = current_setting('t.alfa')::uuid), 'aaaaaaaa-0000-0000-0000-000000000441'::uuid, 'late goes to the creator when nobody is responsible');
select is((select count(*) from public.avisos where titulo in ('Velha', 'Já feita')), 0::bigint, 'old and done activities never remind');
select is((select count(*) from public.avisos where tipo = 'cobranca_vencendo' and valor_centavos = 100000 and agencia_id = current_setting('t.alfa')::uuid), 2::bigint, 'billing reminder carries the balance, for owner and seller');
select is((select count(*) from public.avisos where tipo = 'saida_chegando' and titulo = 'Serra lembrete'), 2::bigint, 'departure reminder for owner and seller');

-- R128: each person sees only their own; the owner also sees the agency-wide ones.
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000443","role":"authenticated"}', true);
set local role authenticated;
select is((select array_agg(tipo::text order by tipo::text) from public.avisos), array['atividade_agora', 'cobranca_vencendo', 'saida_chegando'], 'the seller sees her three');
select is((select count(*) from public.avisos where para_user_id is null), 0::bigint, 'the seller never sees owner notices');
update public.avisos set lido_em = now() where tipo = 'atividade_agora';
select isnt((select lido_em from public.avisos where tipo = 'atividade_agora'), null, 'the seller marks her own as read');
select throws_ok($$select public.gerar_lembretes()$$, '42501', null, 'only the server clock generates reminders');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000441","role":"authenticated"}', true);
select is((select array_agg(tipo::text order by tipo::text) from public.avisos), array['atividade_atrasada', 'cobranca_vencendo', 'saida_chegando'], 'the owner sees agency-wide ones and her own');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000442","role":"authenticated"}', true);
select is((select count(*) from public.avisos), 0::bigint, 'other agencies see nothing');

select * from finish();
rollback;
