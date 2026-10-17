begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Users: A (owner, Alfa), B (owner, Beta), C (seller, Alfa)
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias
  where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

-- Fixtures (as postgres, bypassing RLS)
insert into public.clientes (id, agencia_id, nome) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana'),
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Caio'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Bia');
insert into public.etiquetas (id, agencia_id, nome) values
  ('a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Europa'),
  ('b2000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Praia');
insert into public.anotacoes (id, agencia_id, cliente_id, autor_id, texto) values
  ('a3000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid,
   'a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Nota da A'),
  ('a3000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid,
   'a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Nota que sai com o cliente');
insert into public.cliente_etiquetas (cliente_id, etiqueta_id, agencia_id) values
  ('a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid);

-- Composite foreign keys hold even without RLS (running as postgres)
select throws_ok($$insert into public.cliente_etiquetas (cliente_id, etiqueta_id, agencia_id) values
  ('a1000000-0000-0000-0000-000000000002','b2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid)$$,
  '23503', null, 'cannot tag a client with another agency''s tag');
select throws_ok($$insert into public.cliente_etiquetas (cliente_id, etiqueta_id, agencia_id) values
  ('b1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid)$$,
  '23503', null, 'cannot tag another agency''s client');
select throws_ok($$insert into public.anotacoes (agencia_id, cliente_id, texto) values
  (current_setting('t.alfa')::uuid, 'b1000000-0000-0000-0000-000000000001', 'x')$$,
  '23503', null, 'cannot note another agency''s client');

-- Data rules
select throws_ok($$insert into public.clientes (agencia_id, nome, whatsapp) values (current_setting('t.alfa')::uuid, 'X', '+55 (11) 9')$$,
  '23514', null, 'whatsapp must be digits only');
select throws_ok($$insert into public.clientes (agencia_id, nome) values (current_setting('t.alfa')::uuid, '   ')$$,
  '23514', null, 'client name cannot be blank');
select throws_ok($$insert into public.etiquetas (agencia_id, nome) values (current_setting('t.alfa')::uuid, 'EUROPA')$$,
  '23505', null, 'tag names are unique per agency, ignoring case');
insert into public.clientes (id, agencia_id, nome, consentimento_whatsapp) values
  ('a1000000-0000-0000-0000-000000000009', current_setting('t.alfa')::uuid, 'Com consentimento', 'aceitou');
select isnt((select consentimento_em from public.clientes where id = 'a1000000-0000-0000-0000-000000000009'), null,
  'consent date is stamped when consent is given');
select is((select consentimento_em from public.clientes where id = 'a1000000-0000-0000-0000-000000000001'), null,
  'no consent date while not informed');

-- As A (owner of Alfa)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.clientes where agencia_id = current_setting('t.beta')::uuid), 0::bigint, 'A does not see Beta clients');
select is((select count(*) from public.etiquetas where agencia_id = current_setting('t.beta')::uuid), 0::bigint, 'A does not see Beta tags');
select lives_ok($$insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Novo')$$,
  'A creates a client in own agency');
select is((select criado_por from public.clientes where id = 'a1000000-0000-0000-0000-000000000003'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'creator is stamped from the session');
select throws_ok($$insert into public.clientes (agencia_id, nome) values (current_setting('t.beta')::uuid, 'Invasor')$$,
  '42501', null, 'A cannot create a client in another agency');
select is(public.tmp_rows_affected($$update public.clientes set nome = 'Hack' where id = 'b1000000-0000-0000-0000-000000000001'$$), 0::bigint, 'A cannot update a Beta client');
select is(public.tmp_rows_affected($$delete from public.clientes where id = 'b1000000-0000-0000-0000-000000000001'$$), 0::bigint, 'A cannot delete a Beta client');
select throws_ok($$update public.clientes set agencia_id = current_setting('t.beta')::uuid where id = 'a1000000-0000-0000-0000-000000000003'$$,
  '42501', null, 'a client cannot be moved to another agency');
select lives_ok($$insert into public.anotacoes (id, agencia_id, cliente_id, autor_id, texto) values
  ('a3000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000002', 'tentando falsificar autor')$$, 'A adds a note');
select is((select autor_id from public.anotacoes where id = 'a3000000-0000-0000-0000-000000000003'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'note author cannot be spoofed');
select is(public.tmp_rows_affected($$delete from public.clientes where id = 'a1000000-0000-0000-0000-000000000001'$$), 1::bigint, 'A deletes an own client');
select is((select count(*) from public.anotacoes where cliente_id = 'a1000000-0000-0000-0000-000000000001')
        + (select count(*) from public.cliente_etiquetas where cliente_id = 'a1000000-0000-0000-0000-000000000001'),
  0::bigint, 'deleting a client removes its notes and tags');

-- As C (seller in Alfa)
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select ok((select count(*) from public.clientes) > 0, 'seller sees the agency clients');
select lives_ok($$insert into public.clientes (agencia_id, nome) values (current_setting('t.alfa')::uuid, 'Da vendedora')$$, 'seller creates clients');
select is(public.tmp_rows_affected($$delete from public.anotacoes where id = 'a3000000-0000-0000-0000-000000000001'$$), 0::bigint, 'seller cannot delete someone else''s note');
select lives_ok($$insert into public.anotacoes (id, agencia_id, cliente_id, texto) values
  ('a3000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000002', 'Nota da C')$$, 'seller adds a note');

-- Back to A: owners can delete any note of the agency
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_rows_affected($$delete from public.anotacoes where id = 'a3000000-0000-0000-0000-000000000004'$$), 1::bigint, 'owner deletes a seller''s note');

-- Anonymous
reset role;
set local role anon;
select throws_ok($$select * from public.clientes$$, '42501', null, 'anon has no access to clients');

select * from finish();
rollback;
