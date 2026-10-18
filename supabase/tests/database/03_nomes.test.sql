begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana.dona@test.dev', '{"agencia_nome":"Alfa","nome":"  Ana Dona "}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bruno@test.dev', '{}');

select is((select nome from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Ana Dona',
  'member name comes from signup metadata, trimmed');
select is((select nome from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'bruno',
  'member name falls back to the e-mail prefix');

insert into public.clientes (id, agencia_id, nome)
  select 'a1000000-0000-0000-0000-000000000001', agencia_id, 'Cliente'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

insert into public.anotacoes (id, agencia_id, cliente_id, texto, autor_nome)
  select 'a3000000-0000-0000-0000-000000000001', agencia_id, 'a1000000-0000-0000-0000-000000000001', 'Oi', 'Nome Falso'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select autor_nome from public.anotacoes where id = 'a3000000-0000-0000-0000-000000000001'), 'Ana Dona',
  'note author name is stamped from the member, not the client');
select isnt((select criada_em from public.anotacoes where id = 'a3000000-0000-0000-0000-000000000001'), null, 'note has a timestamp');
select throws_ok($$update public.membros set nome = 'Outro'$$, '42501', null, 'members cannot rename themselves directly');

select * from finish();
rollback;
