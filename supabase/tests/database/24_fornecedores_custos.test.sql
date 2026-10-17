begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vera' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.passeios (id, agencia_id, nome) values
  ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa'),
  ('b5000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Beta');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2027-03-10', 10, 100000),
  ('b6000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b5000000-0000-0000-0000-000000000001', '2027-03-10', 10, 100000);
insert into public.fornecedores (id, agencia_id, nome, tipo) values ('b9000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Van da Beta', 'transporte');

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

-- R51/R52: the seller registers suppliers and costs
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.fornecedores (id, agencia_id, nome, tipo, contato) values ('a9000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Van do Zé', 'transporte', '(11) 98888-0000')$$, 'seller registers a supplier');
select lives_ok($$insert into public.custos_saida (agencia_id, saida_id, fornecedor_id, descricao, valor_centavos, vencimento) values (current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', 'Transfer aeroporto', 150000, '2027-03-01')$$, 'seller registers a cost on the departure');
select is((select criado_por from public.custos_saida), 'cccccccc-0000-0000-0000-000000000003'::uuid, 'author stamped');
select throws_ok($$insert into public.custos_saida (agencia_id, saida_id, fornecedor_id, descricao, valor_centavos) values (current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'b9000000-0000-0000-0000-000000000001', 'x', 100)$$, '23503', null, 'a supplier of another agency is refused');
select throws_ok($$insert into public.custos_saida (agencia_id, saida_id, descricao, valor_centavos) values (current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'x', 0)$$, '23514', null, 'a cost must be positive');
select throws_ok($$insert into public.custos_saida (agencia_id, saida_id, descricao, valor_centavos) values (current_setting('t.alfa')::uuid, 'b6000000-0000-0000-0000-000000000001', 'x', 100)$$, '23503', null, 'not on another agency departure');
select is(public.tmp_rows_affected($$update public.custos_saida set pago_em = '2026-10-17'$$), 1::bigint, 'marks a cost as paid');
select is(public.tmp_rows_affected($$delete from public.fornecedores$$), 0::bigint, 'the seller cannot delete suppliers');
select is((select count(*) from public.fornecedores), 1::bigint, 'only the own agency suppliers are visible');
reset role;

-- Only the owner deletes a supplier; its costs stay, without supplier
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_rows_affected($$delete from public.fornecedores$$), 1::bigint, 'the owner deletes the supplier');
select is((select descricao || '|' || coalesce(fornecedor_id::text, 'sem') from public.custos_saida), 'Transfer aeroporto|sem', 'its cost stays without supplier');
select lives_ok($$select public.excluir_minha_conta()$$, 'deleting the account removes costs and suppliers too');
reset role;
select is((select count(*) from public.custos_saida where agencia_id = current_setting('t.alfa')::uuid), 0::bigint, 'nothing left of the deleted agency');

select * from finish();
rollback;
