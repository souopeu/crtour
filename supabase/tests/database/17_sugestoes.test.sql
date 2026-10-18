begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);

insert into public.clientes (agencia_id, nome, whatsapp, cidade, consentimento_whatsapp) values
  (current_setting('t.alfa')::uuid, 'Ana Souza', '5511999990001', 'Santos', 'pediu_saida');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select set_config('t.res', public.importar_clientes('r.xlsx', repeat('c', 64), $j$[
  {"linha":2,"nome":"Ana Souza","whatsapp":"5511999990001","cidade":"Campinas","email":"Ana@X.com","qtd_pessoas":3,"consentimento_whatsapp":"aceitou"}
]$j$::jsonb)::text, true);

select is((current_setting('t.res')::jsonb ->> 'preenchidos')::int, 2, 'blank fields are filled');
select is((current_setting('t.res')::jsonb ->> 'sugestoes')::int, 1, 'a different value becomes a suggestion');
select is((select email || '|' || qtd_pessoas from public.clientes), 'ana@x.com|3', 'blank e-mail (lowercased) and count are filled');
select is((select cidade from public.clientes), 'Santos', 'existing value is never overwritten');
select is((select consentimento_whatsapp::text from public.clientes), 'pediu_saida', 'consent is never changed by a spreadsheet');
select is((select count(*) from public.sugestoes_cliente where campo = 'cidade' and valor_sugerido = 'Campinas'), 1::bigint, 'suggestion is stored');

select lives_ok($$select public.aceitar_sugestao((select id from public.sugestoes_cliente limit 1))$$, 'accepting works');
select is((select cidade from public.clientes), 'Campinas', 'accepting applies the value');
select is((select count(*) from public.sugestoes_cliente), 0::bigint, 'accepted suggestion is removed');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.sugestoes_cliente), 0::bigint, 'other agency sees none');
select lives_ok($$select public.aceitar_sugestao(gen_random_uuid())$$, 'unknown id does nothing');

select * from finish();
rollback;
