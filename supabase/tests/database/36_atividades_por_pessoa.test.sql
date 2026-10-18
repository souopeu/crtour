begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Users: A (owner, Alfa), B (owner, Beta), C (seller, Alfa)
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias
  where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Bia');

-- September 2026 (Brazil time). The seller: 2 calls + 1 WhatsApp done; the owner: 1 meeting done.
-- Done on 01/10 00:30 in Brazil (03:30 UTC) belongs to October, not September.
insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status, responsavel_id, criado_por) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'ligacao',  'l1', '2026-09-02 15:00Z', 'feito', 'cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001'),
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'ligacao',  'l2', '2026-09-30 23:00Z', 'feito', 'cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001'),
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'whatsapp', 'w1', '2026-09-10 15:00Z', 'feito', 'cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001'),
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'whatsapp', 'w2', '2026-10-01 03:30Z', 'feito', 'cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001'),
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'reuniao',  'r1', '2026-09-15 15:00Z', 'feito', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  -- no person in charge: counts for whoever created it (the seller)
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'tarefa',   't1', '2026-09-20 15:00Z', 'feito', null, 'cccccccc-0000-0000-0000-000000000003'),
  -- overdue (pending, in the past) and future pending
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'ligacao',  'p1', '2026-01-05 15:00Z', 'pendente', 'cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001'),
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'ligacao',  'p2', now() + interval '3 days', 'pendente', 'cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001'),
  (current_setting('t.beta')::uuid, 'b1000000-0000-0000-0000-000000000001', 'ligacao',  'b1', '2026-09-02 15:00Z', 'feito', null, 'bbbbbbbb-0000-0000-0000-000000000002');

-- Deals won in September: one by the seller, one lost (never counts), one won in October.
insert into public.negociacoes (agencia_id, cliente_id, titulo, etapa, responsavel_id, fechado_em, motivo_perda) values
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'g1', 'pago',     'cccccccc-0000-0000-0000-000000000003', '2026-09-12', null),
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'g2', 'viajou',   'cccccccc-0000-0000-0000-000000000003', '2026-10-02', null),
  (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'g3', 'perdido',  'cccccccc-0000-0000-0000-000000000003', '2026-09-20', 'achou_caro');

create temp view rel with (security_invoker = true) as select * from public.atividades_por_pessoa('2026-09');
grant select on rel to authenticated;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select ligacao from rel where nome = 'Vendedora C'), 2, 'calls done in the month, by the person in charge');
select is((select whatsapp from rel where nome = 'Vendedora C'), 1, 'month boundary follows Brazil time');
select is((select tarefa from rel where nome = 'Vendedora C'), 1, 'no person in charge counts for the creator');
select is((select feitas from rel where nome = 'Vendedora C'), 4, 'total done');
select is((select atrasadas from rel where nome = 'Vendedora C'), 1, 'overdue pending only (future pending left out)');
select is((select ganhas from rel where nome = 'Vendedora C'), 1, 'won in the month; lost and next-month wins left out');
select is((select reuniao from rel where nome = 'Dona Ana'), 1, 'owner has her own row');
select is((select count(*) from rel), 2::bigint, 'one row per member; other agencies never appear');
select is((select feitas from public.atividades_por_pessoa('2026-08') where nome = 'Vendedora C'), 0, 'members with nothing in the month still appear, with zeros');
select throws_ok($$select * from public.atividades_por_pessoa('2026-13')$$, '22023', null, 'invalid month is refused');

reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.atividades_por_pessoa('2026-09')$$, '42501', null, 'the seller cannot see the report');

reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select feitas from public.atividades_por_pessoa('2026-09')), 1, 'Beta sees only its own activity');

reset role;
set local role anon;
select throws_ok($$select * from public.atividades_por_pessoa('2026-09')$$, '42501', null, 'anon cannot call it');

select * from finish();
rollback;
