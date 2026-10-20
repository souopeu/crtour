begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- A owns Alfa, C sells in Alfa, B owns Beta.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000451', 'push-a@test.dev', '{"agencia_nome":"Alfa push"}'),
  ('bbbbbbbb-0000-0000-0000-000000000452', 'push-b@test.dev', '{"agencia_nome":"Beta push"}'),
  ('cccccccc-0000-0000-0000-000000000453', 'push-c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000453');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000453', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000451';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000451'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000452'), true);

-- Each person registers only their own device
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000453","role":"authenticated"}', true);
set local role authenticated;
insert into public.inscricoes_push (agencia_id, endpoint, p256dh, auth) values
  (current_setting('t.alfa')::uuid, 'https://push.example/c-celular', repeat('k', 87), repeat('s', 22));
select throws_ok($$insert into public.inscricoes_push (agencia_id, endpoint, p256dh, auth) values (current_setting('t.beta')::uuid, 'https://push.example/c-outra', repeat('k', 87), repeat('s', 22))$$,
  '42501', null, 'cannot register a device in another agency');
select throws_ok($$insert into public.inscricoes_push (user_id, agencia_id, endpoint, p256dh, auth) values ('aaaaaaaa-0000-0000-0000-000000000451', current_setting('t.alfa')::uuid, 'https://push.example/finge', repeat('k', 87), repeat('s', 22))$$,
  '42501', null, 'cannot register a device for someone else');
select throws_ok($$insert into public.inscricoes_push (agencia_id, endpoint, p256dh, auth) values (current_setting('t.alfa')::uuid, 'http://inseguro', repeat('k', 87), repeat('s', 22))$$,
  '23514', null, 'push endpoints are https only');
select throws_ok($$select * from public.pegar_pushes_pendentes()$$, '42501', null, 'only the server clock reads the queue');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000451","role":"authenticated"}', true);
insert into public.inscricoes_push (agencia_id, endpoint, p256dh, auth) values
  (current_setting('t.alfa')::uuid, 'https://push.example/a-celular', repeat('k', 87), repeat('s', 22));
select is((select count(*) from public.inscricoes_push), 1::bigint, 'the owner sees only her own device');

reset role;
select set_config('request.jwt.claims', '', true);
insert into public.avisos (agencia_id, tipo, titulo, cliente_nome, valor_centavos, para_user_id, criado_em) values
  (current_setting('t.alfa')::uuid, 'atividade_agora', 'Ligar', 'Ana', 0, 'cccccccc-0000-0000-0000-000000000453', '2027-03-08 15:00-03'),
  (current_setting('t.alfa')::uuid, 'saida_chegando', 'Serra', '', 0, null, '2027-03-08 15:00-03'),
  (current_setting('t.alfa')::uuid, 'atividade_agora', 'Velho', 'Ana', 0, 'cccccccc-0000-0000-0000-000000000453', '2027-03-08 12:00-03');

create temp table fila as select * from public.pegar_pushes_pendentes('2027-03-08 15:05-03');
select is((select array_agg(titulo || '→' || endpoint order by titulo) from fila),
  array['Ligar→https://push.example/c-celular', 'Serra→https://push.example/a-celular'], 'personal goes to the person, agency-wide to the owner');
select is((select count(*) from fila where titulo = 'Velho'), 0::bigint, 'notices older than 1 hour are not pushed late');
select is((select count(*) from public.pegar_pushes_pendentes('2027-03-08 15:06-03') where aviso_id in (select aviso_id from fila)), 0::bigint, 'each notice is pushed once');
select isnt((select push_enviado_em from public.avisos where titulo = 'Serra' and agencia_id = current_setting('t.alfa')::uuid), null, 'marked as handled');

select public.apagar_inscricoes_push(array(select inscricao_id from fila where titulo = 'Ligar'));
select is((select count(*) from public.inscricoes_push where endpoint like 'https://push.example/%'), 1::bigint, 'a device the push service says is gone is removed');

-- Removing a member removes her devices
delete from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000451';
select is((select count(*) from public.inscricoes_push where endpoint like 'https://push.example/%'), 0::bigint, 'devices go with the membership');

select * from finish();
rollback;
