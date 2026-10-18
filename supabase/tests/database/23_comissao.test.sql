begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vera' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Maria');
insert into public.passeios (id, agencia_id, nome) values ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Lisboa');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', '2027-03-10', 50, 100000);

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;
create function public.tmp_comissoes(p_mes date) returns text language sql as $f$
  select coalesce(string_agg(right(reserva_id::text, 1) || ':' || coalesce(left(vendedor_id::text, 1), '-') || ':' || quitada_em || ':' || comissao_centavos, ',' order by reserva_id), '')
  from public.comissoes_do_mes(p_mes) $f$;
grant execute on function public.tmp_comissoes(date) to authenticated;

-- R48: whoever creates the reservation is the seller by default
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select set_config('t.r0', public.criar_reserva('a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1)::text, true);
select is((select vendedor_id from public.reservas where id = current_setting('t.r0')::uuid), 'cccccccc-0000-0000-0000-000000000003'::uuid, 'seller = who created it');
select throws_ok(format('select public.definir_vendedor_reserva(%L, %L)', current_setting('t.r0'), 'aaaaaaaa-0000-0000-0000-000000000001'), '42501', null, 'the seller cannot reassign it');
reset role;

-- Known data (payments dated; refunds negative), inserted with no logged-in user
select set_config('request.jwt.claims', '', true);
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, situacao, vendedor_id) values
  ('a7000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2, 200000, 'ativa', 'cccccccc-0000-0000-0000-000000000003'),
  ('a7000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 100000, 'ativa', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a7000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 100000, 'ativa', 'cccccccc-0000-0000-0000-000000000003'),
  ('a7000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 100000, 'cancelada', 'cccccccc-0000-0000-0000-000000000003'),
  ('a7000000-0000-0000-0000-000000000005', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 30000, 'ativa', null),
  ('a7000000-0000-0000-0000-000000000006', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 100000, 'ativa', 'cccccccc-0000-0000-0000-000000000003');
insert into public.pagamentos (id, agencia_id, reserva_id, tipo, valor_centavos, data, estorno_de) values
  ('a8000000-0000-0000-0000-000000000011', current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000001', 'sinal', 100000, '2026-09-20', null),
  ('a8000000-0000-0000-0000-000000000012', current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000001', 'saldo', 100000, '2026-10-05', null),
  ('a8000000-0000-0000-0000-000000000021', current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000002', 'saldo', 100000, '2026-10-10', null),
  ('a8000000-0000-0000-0000-000000000031', current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000003', 'saldo', 100000, '2026-09-15', null),
  ('a8000000-0000-0000-0000-000000000041', current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000004', 'saldo', 100000, '2026-10-03', null),
  ('a8000000-0000-0000-0000-000000000051', current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000005', 'saldo', 30000, '2026-10-02', null),
  ('a8000000-0000-0000-0000-000000000061', current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000006', 'saldo', 100000, '2026-10-01', null),
  ('a8000000-0000-0000-0000-000000000063', current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000006', 'saldo', 100000, '2026-10-20', null);
insert into public.pagamentos (agencia_id, reserva_id, tipo, valor_centavos, data, estorno_de) values
  (current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000002', 'estorno', 50000, '2026-10-12', 'a8000000-0000-0000-0000-000000000021'),
  (current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000006', 'estorno', 100000, '2026-10-02', 'a8000000-0000-0000-0000-000000000061');

-- R49: only the owner sets the rule and the values
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_rows_affected($$update public.agencias set regra_comissao = 'percentual_vendedor'$$), 0::bigint, 'seller cannot choose the rule');
select is(public.tmp_rows_affected($$update public.membros set comissao_percentual = 50$$), 0::bigint, 'seller cannot set her own percentage');
select throws_ok($$update public.passeios set comissao_percentual = 50$$, '42501', null, 'seller cannot change a tour commission');
select lives_ok($$update public.passeios set nome = 'Lisboa'$$, 'but still edits the tour itself');
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_comissoes('2026-10-01'), '', 'no rule chosen: no commission');
select is(public.tmp_rows_affected($$update public.membros set comissao_percentual = case when user_id = 'cccccccc-0000-0000-0000-000000000003' then 5 else 3 end$$), 2::bigint, 'owner sets percentages per person');
select is(public.tmp_rows_affected($$update public.passeios set comissao_percentual = 10, comissao_por_pessoa_centavos = 5000$$), 1::bigint, 'owner sets the tour commission');
select throws_ok($$update public.membros set comissao_percentual = 101$$, '23514', null, 'percentage up to 100');

-- R50: commission in the month it was fully paid; refund that reopens the balance removes it; cancelled never counts
update public.agencias set regra_comissao = 'percentual_vendedor';
select is(public.tmp_comissoes('2026-10-01'), '1:c:2026-10-05:10000,5:-:2026-10-02:0,6:c:2026-10-20:5000', '% per seller (Oct): 5% of 2.000 and 1.000; no seller = 0; partial refund and cancelled out');
select is(public.tmp_comissoes('2026-09-01'), '3:c:2026-09-15:5000', 'September only has what was paid in September');
update public.agencias set regra_comissao = 'percentual_passeio';
select is(public.tmp_comissoes('2026-10-01'), '1:c:2026-10-05:20000,5:-:2026-10-02:3000,6:c:2026-10-20:10000', '% per tour: 10% of each');
update public.agencias set regra_comissao = 'valor_por_pessoa';
select is(public.tmp_comissoes('2026-10-01'), '1:c:2026-10-05:10000,5:-:2026-10-02:5000,6:c:2026-10-20:5000', 'fixed per passenger: R$ 50 × people');
reset role;

-- The seller sees only her own
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_comissoes('2026-10-01'), '1:c:2026-10-05:10000,6:c:2026-10-20:5000', 'the seller sees only her commissions');
reset role;

-- R48: owner reassigns; removing the seller leaves her reservations without seller
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.definir_vendedor_reserva('a7000000-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000003')$$, 'owner sets who sold it');
select is((select vendedor_id from public.reservas where id = 'a7000000-0000-0000-0000-000000000005'), 'cccccccc-0000-0000-0000-000000000003'::uuid, 'seller changed');
select throws_ok($$select public.definir_vendedor_reserva('a7000000-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000009')$$, '23503', null, 'only someone of the agency');
select lives_ok($$select public.remover_membro('cccccccc-0000-0000-0000-000000000003')$$, 'owner removes the seller');
select is((select count(*) from public.reservas where vendedor_id is not null and id <> 'a7000000-0000-0000-0000-000000000002'), 0::bigint, 'her reservations stay, without seller');
reset role;

select * from finish();
rollback;
