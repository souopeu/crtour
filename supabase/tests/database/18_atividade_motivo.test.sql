begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
insert into public.clientes (id, agencia_id, nome) values ('cccccccc-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, motivo)
  values (current_setting('t.alfa')::uuid, 'cccccccc-0000-0000-0000-000000000001', 'ligacao', 'Ligar', now(), 'Pediu orçamento de Lisboa')$$, 'a reason is stored');
select lives_ok($$insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando)
  values (current_setting('t.alfa')::uuid, 'cccccccc-0000-0000-0000-000000000001', 'ligacao', 'Ligar de novo', now())$$, 'the reason is optional');
select throws_ok($$insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, motivo)
  values (current_setting('t.alfa')::uuid, 'cccccccc-0000-0000-0000-000000000001', 'ligacao', 'Ligar', now(), '   ')$$, '23514', null, 'a blank reason is refused');

select * from finish();
rollback;
