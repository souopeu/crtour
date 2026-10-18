begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome, whatsapp, email) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana', '5511999990001', null),
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Bia', null, 'bia@x.com'),
  ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Gêmea 1', '5511999990009', null),
  ('a1000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'Gêmea 2', '5511999990009', null),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Ana da Beta', '5511999990001', null);
insert into public.passeios (id, agencia_id, nome) values
  ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa clássica'),
  ('a5000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Duplicado'),
  ('a5000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Duplicado');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos, situacao) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2027-03-10', 3, 100000, 'aberta'),
  ('a6000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2027-04-10', 3, 100000, 'encerrada');

create function public.tmp_problemas(p jsonb) returns text language sql as $f$
  select string_agg(linha || ':' || coalesce(problema, 'ok') || ':' || coalesce(vagas_livres::text, '-'), ',' order by linha)
  from public.conferir_reservas_importacao(p) $f$;
grant execute on function public.tmp_problemas(jsonb) to authenticated;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- R44/R45: checking finds client, tour and departure; never creates them
select is(public.tmp_problemas($$[
  {"linha":2,"whatsapp":"5511999990001","passeio":" lisboa CLÁSSICA ","data":"2027-03-10"},
  {"linha":3,"email":"BIA@x.com","passeio":"Lisboa clássica","data":"2027-03-10"},
  {"linha":4,"whatsapp":"5599999999999","passeio":"Lisboa clássica","data":"2027-03-10"},
  {"linha":5,"whatsapp":"5511999990009","passeio":"Lisboa clássica","data":"2027-03-10"},
  {"linha":6,"whatsapp":"5511999990001","passeio":"Paris","data":"2027-03-10"},
  {"linha":7,"whatsapp":"5511999990001","passeio":"Duplicado","data":"2027-03-10"},
  {"linha":8,"whatsapp":"5511999990001","passeio":"Lisboa clássica","data":"2027-05-01"},
  {"linha":9,"whatsapp":"5511999990001","passeio":"Lisboa clássica","data":"2027-04-10"},
  {"linha":10,"passeio":"Lisboa clássica","data":"2027-03-10"}
]$$),
  '2:ok:3,3:ok:3,4:cliente_nao_encontrado:-,5:cliente_ambiguo:-,6:passeio_nao_encontrado:-,7:passeio_ambiguo:-,8:saida_nao_encontrada:-,9:saida_fechada:-,10:cliente_nao_encontrado:-',
  'each row: found, or why not (client by WhatsApp or e-mail, only in this agency)');
select is((select count(*) from public.clientes) + (select count(*) from public.passeios) + (select count(*) from public.saidas), 9::bigint, 'checking creates nothing');

-- R46: import row by row; over capacity and over-payment are refused, the rest goes in
select set_config('t.res', public.importar_reservas('reservas.xlsx', repeat('a', 64), $$[
  {"linha":2,"whatsapp":"5511999990001","passeio":"Lisboa clássica","data":"2027-03-10","pessoas":2,"pago":50000,"forma":"pix","data_pagamento":"2026-10-01"},
  {"linha":3,"email":"bia@x.com","passeio":"Lisboa clássica","data":"2027-03-10","pessoas":1,"total":90000,"pago":90000,"forma":"cartao","data_pagamento":"2026-10-02"},
  {"linha":4,"email":"bia@x.com","passeio":"Lisboa clássica","data":"2027-03-10","pessoas":1},
  {"linha":5,"whatsapp":"5599999999999","passeio":"Lisboa clássica","data":"2027-03-10","pessoas":1}
]$$)::text, true);
select is((current_setting('t.res')::jsonb ->> 'criadas')::int, 2, 'two reservations created');
select is(current_setting('t.res')::jsonb -> 'recusadas', '[{"linha": 4, "codigo": "CR001"}, {"linha": 5, "codigo": "cliente_nao_encontrado"}]'::jsonb, 'refused rows say why (no seats; client not found)');
select is((select string_agg(qtd_pessoas || ':' || valor_total_centavos, ',' order by valor_total_centavos) from public.reservas), '1:90000,2:200000', 'total from the sheet, or price × people');
select is((select string_agg(tipo || ':' || forma || ':' || valor_centavos || ':' || data, ',' order by valor_centavos) from public.pagamentos), 'sinal:pix:50000:2026-10-01,saldo:cartao:90000:2026-10-02', 'payments through the normal path (deposit / full)');
select is((select count(*) from public.reservas where importacao_id = (current_setting('t.res')::jsonb ->> 'id')::uuid), 2::bigint, 'reservations linked to the import');
select is((select qtd_criadas || '/' || qtd_recusadas from public.importacoes_reservas), '2/2', 'import keeps its counts');

-- A payment bigger than the total refuses the whole row (no half-made reservation)
select set_config('t.res2', public.importar_reservas('outra.xlsx', repeat('b', 64), $$[
  {"linha":2,"whatsapp":"5511999990001","passeio":"Lisboa clássica","data":"2027-03-10","pessoas":0}
]$$)::text, true);
select is(current_setting('t.res2')::jsonb -> 'recusadas', '[{"linha": 2, "codigo": "23514"}]'::jsonb, 'invalid people count refused');
select is((select count(*) from public.reservas), 2::bigint, 'nothing half-made');
select throws_ok($$select public.importar_reservas('x.xlsx', repeat('a', 64), '[]')$$, '23505', null, 'the same file cannot be imported twice');

-- R47: undo while untouched; blocked after a change
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a6000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2027-06-10', 5, 1000);
select set_config('t.res3', public.importar_reservas('junho.xlsx', repeat('c', 64), $$[
  {"linha":2,"whatsapp":"5511999990001","passeio":"Lisboa clássica","data":"2027-06-10","pessoas":1,"pago":1000,"forma":"pix","data_pagamento":"2026-10-03"}
]$$)::text, true);
reset role;
insert into public.passageiros (agencia_id, reserva_id, nome)
  select agencia_id, id, 'Acompanhante' from public.reservas where saida_id = 'a6000000-0000-0000-0000-000000000003';
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format('select public.desfazer_importacao_reservas(%L)', current_setting('t.res3')::jsonb ->> 'id'), 'CR012', null, 'blocked after someone added a companion');
reset role;
delete from public.passageiros;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format('select public.desfazer_importacao_reservas(%L)', current_setting('t.res3')::jsonb ->> 'id'), '42501', null, 'another agency cannot undo it');
select is((select count(*) from public.importacoes_reservas), 0::bigint, 'another agency does not see the imports');
select is((select count(*) from public.conferir_reservas_importacao('[{"linha":2,"whatsapp":"5511999990001","passeio":"Lisboa clássica","data":"2027-03-10"}]') where problema = 'passeio_nao_encontrado'), 1::bigint, 'another agency does not find our tours');
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format('select public.desfazer_importacao_reservas(%L)', current_setting('t.res3')::jsonb ->> 'id'), 'untouched import can be undone');
select is((select count(*) from public.reservas where saida_id = 'a6000000-0000-0000-0000-000000000003'), 0::bigint, 'its reservations are gone');
select is((select count(*) from public.pagamentos where valor_centavos = 1000), 0::bigint, 'and its payments');
select is((select count(*) from public.importacoes_reservas), 2::bigint, 'and the import record; the others stay');
select throws_ok($$insert into public.importacoes_reservas (agencia_id, nome, hash_arquivo) values (current_setting('t.alfa')::uuid, 'x', repeat('d', 64))$$, '42501', null, 'imports are written only through the import function');
select throws_ok($$update public.reservas set importacao_id = null$$, '42501', null, 'the import link cannot be edited by hand');
reset role;
select lives_ok($$select 1$$, 'done');

select * from finish();
rollback;
