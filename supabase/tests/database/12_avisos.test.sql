begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Maria Cliente'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Bia');
insert into public.negociacoes (id, agencia_id, cliente_id, titulo, valor_centavos) values
  ('a4000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Lisboa em março', 1000000),
  ('b4000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b1000000-0000-0000-0000-000000000001', 'Praia', 500000);

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

-- The seller wins the deal: the owner gets a notice
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'pago' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'seller moves the deal to "pago"');
select is((select count(*) from public.avisos), 0::bigint, 'the seller does not see the owner''s notices');
select throws_ok($$insert into public.avisos (agencia_id, tipo, negociacao_id, titulo, cliente_nome, valor_centavos) values (current_setting('t.alfa')::uuid, 'negociacao_ganha', 'a4000000-0000-0000-0000-000000000001', 'x', 'y', 1)$$, '42501', null, 'notices cannot be written directly');

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.avisos), 1::bigint, 'the owner sees one notice');
select is((select titulo || '|' || cliente_nome || '|' || valor_centavos || '|' || por_nome || '|' || (lido_em is null)::text from public.avisos),
  'Lisboa em março|Maria Cliente|1000000|Vendedora C|true', 'the notice says which deal, client, value and who moved it');

-- Staying in won stages does not repeat the notice; going back and winning again does
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'viajou' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'moves on to "viajou"');
select is((select count(*) from public.avisos), 1::bigint, 'moving between won stages creates no new notice');
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'orcamento' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'goes back to an open stage');
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'pago' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'wins again');
select is((select count(*) from public.avisos), 2::bigint, 'a second win creates a second notice');

-- Marking as read
select is(public.tmp_rows_affected($$update public.avisos set lido_em = now()$$), 2::bigint, 'the owner marks the notices as read');
select throws_ok($$update public.avisos set titulo = 'Adulterado'$$, '42501', null, 'only the read mark can be changed');
select throws_ok($$delete from public.avisos$$, '42501', null, 'notices cannot be deleted');

-- The loss reason is kept in the history
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'perdido', motivo_perda = 'achou_caro' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'the deal is lost with a reason');
select is((select motivo::text from public.negociacao_eventos where negociacao_id = 'a4000000-0000-0000-0000-000000000001' and para = 'perdido'), 'achou_caro', 'the history keeps the reason');
select is((select count(*) from public.negociacao_eventos where negociacao_id = 'a4000000-0000-0000-0000-000000000001' and motivo is not null), 1::bigint, 'only the loss event carries a reason');
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'orcamento' where id = 'a4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'the client resumes: the deal comes back');
select is((select motivo_perda is null from public.negociacoes where id = 'a4000000-0000-0000-0000-000000000001'), true, 'the reason is cleared on the deal');
select is((select count(*) from public.negociacao_eventos where negociacao_id = 'a4000000-0000-0000-0000-000000000001' and para = 'perdido'), 1::bigint, 'but the loss stays in the history');

-- Isolation
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.avisos), 0::bigint, 'another agency sees no notices');
select is(public.tmp_rows_affected($$update public.negociacoes set etapa = 'pago' where id = 'b4000000-0000-0000-0000-000000000001'$$), 1::bigint, 'Beta wins its own deal');
select is((select count(*) from public.avisos), 1::bigint, 'and gets its own single notice');
select is((select count(*) from public.avisos where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'never one of Alfa''s');

set local role anon;
select throws_ok($$select * from public.avisos$$, '42501', null, 'anon has no access');

-- Deleting the account removes notices too
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.excluir_minha_conta()$$, 'the owner can delete an account that has notices');
reset role;
select is((select count(*) from public.avisos where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'notices are gone with the account');

select * from finish();
rollback;
