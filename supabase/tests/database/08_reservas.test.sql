begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana'),
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Beto'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Bia');
insert into public.passeios (id, agencia_id, nome) values
  ('a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa'),
  ('b2000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Praia');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos, situacao) values
  ('a3000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000001', '2027-03-10', 5, 100000, 'aberta'),
  ('a3000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000001', '2027-04-10', 3, 50000, 'aberta'),
  ('a3000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000001', '2026-01-10', 5, 100000, 'encerrada'),
  ('b3000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b2000000-0000-0000-0000-000000000001', '2027-05-10', 5, 100000, 'aberta');
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  ('b4000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 1, 100000);

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- Reserving
select set_config('t.r1', public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2)::text, true);
select isnt(current_setting('t.r1'), '', 'reserving returns the reservation id');
select is((select valor_total_centavos from public.reservas where id = current_setting('t.r1')::uuid), 200000, 'total defaults to people x price');
select is((select reservadas || '/' || livres from public.v_saidas_vagas where id = 'a3000000-0000-0000-0000-000000000001'), '2/3', 'the view counts reserved and free seats');
select lives_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 1, 90000)$$, 'a custom total is accepted');
select is((select valor_total_centavos from public.reservas where qtd_pessoas = 1 and saida_id = 'a3000000-0000-0000-0000-000000000001'), 90000, 'the custom total is stored');

-- The seat lock
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 3)$$, 'CR001', null, 'refuses more people than free seats');
select lives_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2)$$, 'fills the departure exactly');
select is((select livres from public.v_saidas_vagas where id = 'a3000000-0000-0000-0000-000000000001'), 0, 'no free seats left');
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1)$$, 'CR001', null, 'a full departure refuses one more');
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 1)$$, 'CR002', null, 'only open departures accept reservations');
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 0)$$, '23514', null, 'at least one person');

-- Isolation and tamper-proofing
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 1)$$, '23503', null, 'cannot reserve for another agency''s client');
select throws_ok($$select public.criar_reserva('b3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1)$$, '42501', null, 'cannot reserve another agency''s departure');
select throws_ok($$insert into public.reservas (agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  (current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 1, 1)$$, '42501', null, 'no direct insert (it would bypass the lock)');
select throws_ok($$update public.reservas set qtd_pessoas = 1$$, '42501', null, 'no direct update');
select throws_ok($$delete from public.reservas$$, '42501', null, 'no direct delete (history is kept)');
select is((select count(*) from public.reservas where agencia_id = current_setting('t.beta')::uuid), 0::bigint, 'other agencies'' reservations are invisible');
select throws_ok($$select public.cancelar_reserva('b4000000-0000-0000-0000-000000000001')$$, '42501', null, 'cannot cancel another agency''s reservation');

-- Cancelling frees seats and keeps the record
select lives_ok($$select public.cancelar_reserva(current_setting('t.r1')::uuid)$$, 'cancels a reservation');
select is((select reservadas || '/' || livres from public.v_saidas_vagas where id = 'a3000000-0000-0000-0000-000000000001'), '3/2', 'cancelling releases the seats');
select is((select situacao::text from public.reservas where id = current_setting('t.r1')::uuid), 'cancelada', 'the cancelled reservation stays as history');
select throws_ok($$select public.cancelar_reserva(current_setting('t.r1')::uuid)$$, 'CR004', null, 'cannot cancel twice');
select lives_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 2)$$, 'released seats can be sold again');

-- Capacity guard
select throws_ok($$update public.saidas set capacidade = 4 where id = 'a3000000-0000-0000-0000-000000000001'$$, 'CR003', null, 'capacity cannot drop below the reserved seats');
select is(public.tmp_rows_affected($$update public.saidas set capacidade = 5, preco_centavos = 110000 where id = 'a3000000-0000-0000-0000-000000000001'$$), 1::bigint, 'capacity equal to the reserved seats is fine');
select throws_ok($$delete from public.saidas where id = 'a3000000-0000-0000-0000-000000000001'$$, '23503', null, 'a departure with reservations cannot be deleted');

-- Seller has the same access
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 1)$$, 'seller reserves too');
select is((select criada_por from public.reservas where saida_id = 'a3000000-0000-0000-0000-000000000002'), 'cccccccc-0000-0000-0000-000000000003'::uuid, 'the creator is stamped from the session');

-- A client with reservations cannot be deleted
reset role;
select throws_ok($$delete from public.clientes where id = 'a1000000-0000-0000-0000-000000000002'$$, '23503', null, 'a client with reservations cannot be deleted');

set local role anon;
select throws_ok($$select public.criar_reserva('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 1)$$, '42501', null, 'anon cannot reserve');

select * from finish();
rollback;
