begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- E10-2 (R149–R150): commissions paid, payments to suppliers in a batch and receipts of what the agency paid.
-- A owns Alfa, C sells in Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000521', 'pf-a@test.dev', '{"agencia_nome":"Alfa pagos"}'),
  ('bbbbbbbb-0000-0000-0000-000000000522', 'pf-b@test.dev', '{"agencia_nome":"Beta pagos"}'),
  ('cccccccc-0000-0000-0000-000000000523', 'pf-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000523');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000523', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000521';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000521'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000522'), true);

insert into public.fornecedores (id, agencia_id, nome) values ('a7000000-0000-0000-0000-000000000521', current_setting('t.alfa')::uuid, 'Viação Sol');
insert into public.passeios (id, agencia_id, nome) values ('a2000000-0000-0000-0000-000000000521', current_setting('t.alfa')::uuid, 'Praia');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a3000000-0000-0000-0000-000000000521', current_setting('t.alfa')::uuid, 'a2000000-0000-0000-0000-000000000521', '2027-01-10', 10, 10000);
insert into public.custos_saida (id, agencia_id, saida_id, fornecedor_id, descricao, valor_centavos) values
  ('a8000000-0000-0000-0000-000000000521', current_setting('t.alfa')::uuid, 'a3000000-0000-0000-0000-000000000521', 'a7000000-0000-0000-0000-000000000521', 'Ônibus', 200000);
insert into public.contas_pagar (id, agencia_id, descricao, valor_centavos, vencimento, fornecedor_id) values
  ('a9000000-0000-0000-0000-000000000521', current_setting('t.alfa')::uuid, 'Revisão do ônibus', 50000, '2027-01-05', 'a7000000-0000-0000-0000-000000000521');
insert into public.contas_pagar (id, agencia_id, descricao, valor_centavos, vencimento) values
  ('b9000000-0000-0000-0000-000000000522', current_setting('t.beta')::uuid, 'Conta da Beta', 1000, '2027-01-05');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000521","role":"authenticated"}', true);
set local role authenticated;

-- Receipt of a payment made (owner only)
select lives_ok($$insert into public.comprovantes_saida (id, agencia_id, caminho, tipo, tamanho)
  values ('a6000000-0000-0000-0000-000000000521', current_setting('t.alfa')::uuid, current_setting('t.alfa') || '/lote/x.pdf', 'application/pdf', 100)$$, 'the owner registers a receipt');
select throws_ok($$insert into public.comprovantes_saida (agencia_id, caminho, tipo, tamanho) values (current_setting('t.alfa')::uuid, 'outra/lote/x.pdf', 'application/pdf', 100)$$,
  '23514', null, 'the file must be inside the agency folder');

-- Batch payment to a supplier: cost + bill, same date, form and receipt
select is(public.pagar_em_lote(array['a9000000-0000-0000-0000-000000000521'::uuid, 'b9000000-0000-0000-0000-000000000522'::uuid], array['a8000000-0000-0000-0000-000000000521'::uuid],
  '2026-10-20', 'pix', 'a6000000-0000-0000-0000-000000000521'), 2, 'pays the agency''s bill and cost, never another agency''s');
select is((select pago_em::text || ' ' || forma_pago::text from public.custos_saida where id = 'a8000000-0000-0000-0000-000000000521'), '2026-10-20 pix', 'the cost keeps date and form');
select is((select comprovante_id::text from public.contas_pagar where id = 'a9000000-0000-0000-0000-000000000521'), 'a6000000-0000-0000-0000-000000000521', 'the bill points to the receipt');
select is(public.pagar_em_lote(array['a9000000-0000-0000-0000-000000000521'::uuid], array[]::uuid[], '2026-10-21', 'dinheiro', null), 0, 'something already paid is not paid again');
select throws_ok($$select public.pagar_em_lote(array[]::uuid[], array['a8000000-0000-0000-0000-000000000521'::uuid], current_date + 3, 'pix', null)$$, '22008', null, 'no payment in the future');

-- Commission paid, in two payments (the second settles a difference)
select lives_ok($$insert into public.comissoes_pagas (agencia_id, vendedor_id, mes, valor_centavos, pago_em, forma_pago)
  values (current_setting('t.alfa')::uuid, 'cccccccc-0000-0000-0000-000000000523', '2026-10-01', 10000, '2026-10-25', 'pix')$$, 'the owner pays a commission');
select lives_ok($$insert into public.comissoes_pagas (agencia_id, vendedor_id, mes, valor_centavos, pago_em, forma_pago)
  values (current_setting('t.alfa')::uuid, 'cccccccc-0000-0000-0000-000000000523', '2026-10-01', 2500, '2026-10-26', 'pix')$$, 'and later the difference');
select throws_ok($$insert into public.comissoes_pagas (agencia_id, vendedor_id, mes, valor_centavos, pago_em, forma_pago)
  values (current_setting('t.alfa')::uuid, 'cccccccc-0000-0000-0000-000000000523', '2026-10-15', 100, '2026-10-26', 'pix')$$, '23514', null, 'the month is its first day');
select throws_ok($$insert into public.comissoes_pagas (agencia_id, vendedor_id, mes, valor_centavos, pago_em, forma_pago)
  values (current_setting('t.alfa')::uuid, 'bbbbbbbb-0000-0000-0000-000000000522', '2026-10-01', 100, '2026-10-26', 'pix')$$, '23503', null, 'only to a member of the agency');

-- The seller sees her own commission payments, nothing else
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000523","role":"authenticated"}', true);
select is((select sum(valor_centavos) from public.comissoes_pagas), 12500::bigint, 'the seller sees what she was paid');
select is((select count(*) from public.comprovantes_saida), 0::bigint, 'but not the agency receipts');
select throws_ok($$insert into public.comissoes_pagas (agencia_id, vendedor_id, mes, valor_centavos, pago_em, forma_pago)
  values (current_setting('t.alfa')::uuid, 'cccccccc-0000-0000-0000-000000000523', '2026-10-01', 999, '2026-10-26', 'pix')$$, '42501', null, 'and cannot pay herself');
select throws_ok($$select public.pagar_em_lote(array['a9000000-0000-0000-0000-000000000521'::uuid], array[]::uuid[], '2026-10-20', 'pix', null)$$, '42501', null, 'nor pay suppliers');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000522","role":"authenticated"}', true);
select is((select count(*) from public.comissoes_pagas), 0::bigint, 'another agency sees nothing');

select * from finish();
rollback;
