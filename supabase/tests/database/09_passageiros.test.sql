begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana Responsável');
insert into public.passeios (id, agencia_id, nome) values
  ('a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000001', '2027-03-10', 20, 100000);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
-- reservation of 3 people: the responsible client + 2 companions; and one of 2 people
select set_config('t.r3', public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 3)::text, true);
select set_config('t.r2', public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2)::text, true);

select set_config('t.p1', public.adicionar_passageiro(current_setting('t.r3')::uuid, '  Maria Silva ', '5511999990001')::text, true);
select is((select nome || '|' || whatsapp from public.passageiros where id = current_setting('t.p1')::uuid), 'Maria Silva|5511999990001', 'adds a companion (name trimmed)');
select lives_ok($$select public.adicionar_passageiro(current_setting('t.r3')::uuid, 'João Souza', null, true)$$, 'adds a companion and registers him as a client (new lead)');
select is((select c.consentimento_whatsapp::text || '|' || c.nome from public.passageiros p join public.clientes c on c.id = p.cliente_id where p.nome = 'João Souza'),
  'nao_informado|João Souza', 'the new lead has no marketing consent');
select throws_ok($$select public.adicionar_passageiro(current_setting('t.r3')::uuid, 'Terceiro', null)$$, 'CR005', null, 'a 3-person reservation holds only 2 companions (the client is the first)');
select is((select count(*) from public.passageiros where reserva_id = current_setting('t.r3')::uuid), 2::bigint, 'two companions stored');

select throws_ok($$select public.adicionar_passageiro(current_setting('t.r2')::uuid, '   ')$$, '23514', null, 'a blank name is refused');
select throws_ok($$select public.adicionar_passageiro(current_setting('t.r2')::uuid, 'Fulano', '123')$$, '23514', null, 'an invalid WhatsApp is refused');
select throws_ok($$insert into public.passageiros (agencia_id, reserva_id, nome) values (current_setting('t.alfa')::uuid, current_setting('t.r2')::uuid, 'Direto')$$, '42501', null, 'no direct insert');
select throws_ok($$update public.passageiros set nome = 'X'$$, '42501', null, 'no direct update');
select throws_ok($$delete from public.passageiros$$, '42501', null, 'no direct delete');

select lives_ok($$select public.remover_passageiro(current_setting('t.p1')::uuid)$$, 'removes a companion');
select is((select count(*) from public.passageiros where reserva_id = current_setting('t.r3')::uuid), 1::bigint, 'one companion left');
select lives_ok($$select public.adicionar_passageiro(current_setting('t.r3')::uuid, 'Substituta')$$, 'the freed place can be filled again');
select is((select count(*) from public.clientes where nome = 'João Souza'), 1::bigint, 'removing a companion keeps the lead that was created');

select lives_ok($$select public.cancelar_reserva(current_setting('t.r2')::uuid)$$, 'cancels a reservation');
select throws_ok($$select public.adicionar_passageiro(current_setting('t.r2')::uuid, 'Tarde demais')$$, 'CR006', null, 'a cancelled reservation takes no companions');

-- Other agency
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.adicionar_passageiro(current_setting('t.r3')::uuid, 'Invasor')$$, '42501', null, 'cannot add to another agency''s reservation');
select throws_ok($$select public.remover_passageiro((select id from public.passageiros limit 1))$$, '42501', null, 'cannot remove another agency''s companion');
select is((select count(*) from public.passageiros), 0::bigint, 'other agencies see no passengers');

-- Integrity
reset role;
select throws_ok($$delete from public.clientes where nome = 'João Souza'$$, '23503', null, 'a client linked to a reservation passenger cannot be deleted');

set local role anon;
select throws_ok($$select public.adicionar_passageiro(current_setting('t.r3')::uuid, 'Anon')$$, '42501', null, 'anon cannot add');

-- Deleting the account removes everything in the right order
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.excluir_minha_conta()$$, 'the owner can delete an account that has reservations and companions');
reset role;
select is((select count(*) from public.passageiros) + (select count(*) from public.reservas where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'passengers and reservations are gone');

select * from finish();
rollback;
