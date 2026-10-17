begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

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

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

insert into public.passeios (id, agencia_id, nome, destino) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa clássica', 'Portugal'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Praia Beta', 'Bahia');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', '2027-03-10', 12, 890000),
  ('b2000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b1000000-0000-0000-0000-000000000001', '2027-04-01', 8, 120000);

-- Composite foreign key holds even without RLS
select throws_ok($$insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos) values
  (current_setting('t.alfa')::uuid, 'b1000000-0000-0000-0000-000000000001', '2027-05-01', 10, 100)$$, '23503', null, 'a departure cannot point to another agency''s tour');

-- Data rules
select throws_ok($$insert into public.passeios (agencia_id, nome) values (current_setting('t.alfa')::uuid, '   ')$$, '23514', null, 'tour name cannot be blank');
select throws_ok($$insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', '2027-05-01', 0, 100)$$, '23514', null, 'capacity must be at least 1');
select throws_ok($$insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', '2027-05-01', 501, 100)$$, '23514', null, 'capacity has an upper limit');
select throws_ok($$insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', '2027-05-01', 10, -1)$$, '23514', null, 'price cannot be negative');
select throws_ok($$insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', null, 10, 100)$$, '23502', null, 'a departure needs a date');
select is((select situacao::text from public.saidas where id = 'a2000000-0000-0000-0000-000000000001'), 'aberta', 'departures start open');
select throws_ok($$delete from public.passeios where id = 'a1000000-0000-0000-0000-000000000001'$$, '23503', null, 'a tour with departures cannot be deleted (archive it instead)');

-- As A (owner of Alfa)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.passeios), 1::bigint, 'A sees only own tours');
select is((select count(*) from public.saidas), 1::bigint, 'A sees only own departures');
select lives_ok($$insert into public.passeios (id, agencia_id, nome, destino) values ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Noronha', 'PE')$$, 'A creates a tour');
select lives_ok($$insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000002', '2027-06-01', 20, 450000)$$, 'A creates a departure');
select throws_ok($$insert into public.passeios (agencia_id, nome) values (current_setting('t.beta')::uuid, 'Invasor')$$, '42501', null, 'A cannot create tours in another agency');
select is(public.tmp_rows_affected($$update public.saidas set capacidade = 99 where id = 'b2000000-0000-0000-0000-000000000001'$$), 0::bigint, 'A cannot change another agency''s departure');
select is(public.tmp_rows_affected($$update public.saidas set capacidade = 14, preco_centavos = 900000, situacao = 'cancelada' where id = 'a2000000-0000-0000-0000-000000000001'$$), 1::bigint, 'A edits an own departure');
select throws_ok($$update public.saidas set passeio_id = 'a1000000-0000-0000-0000-000000000002' where id = 'a2000000-0000-0000-0000-000000000001'$$, '42501', null, 'a departure cannot be moved to another tour');
select throws_ok($$update public.passeios set agencia_id = current_setting('t.beta')::uuid where id = 'a1000000-0000-0000-0000-000000000001'$$, '42501', null, 'a tour cannot change agency');
select is(public.tmp_rows_affected($$update public.passeios set arquivado = true where id = 'a1000000-0000-0000-0000-000000000001'$$), 1::bigint, 'A archives a tour');

-- Seller has the same access
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select ok((select count(*) from public.passeios) >= 2, 'seller sees the agency tours');
select lives_ok($$insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000002', '2027-07-01', 5, 0)$$, 'seller creates departures (free ones allowed)');

reset role;
set local role anon;
select throws_ok($$select * from public.passeios$$, '42501', null, 'anon has no access');

select * from finish();
rollback;
