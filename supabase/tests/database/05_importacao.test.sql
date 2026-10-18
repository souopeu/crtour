begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (agencia_id, nome, whatsapp, email) values
  (current_setting('t.alfa')::uuid, 'Ana Souza', '5511999990001', null),
  (current_setting('t.alfa')::uuid, 'Beto', null, 'beto@x.com');

select set_config('t.linhas', $j$[
  {"linha":2,"nome":"Ana Souza","whatsapp":"5511999990001"},
  {"linha":3,"nome":"Carlos","whatsapp":"5511999990003","cidade":"Santos","origem":"instagram","qtd_pessoas":2,"destinos_interesse":["Lisboa","Paris"],"aniversario":"1990-05-17","consentimento_whatsapp":"aceitou"},
  {"linha":4,"nome":"Carlos Duplicado","whatsapp":"5511999990003"},
  {"linha":5,"nome":"Beto Outro","email":"BETO@x.com"},
  {"linha":6,"nome":"João Só Nome"},
  {"linha":7,"nome":"joao so nome"},
  {"linha":8,"nome":"Dora","email":"dora@x.com","etiquetas":["Europa","  europa ","VIP"]}
]$j$, true);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select situacao from public.classificar_linhas_importacao(current_setting('t.linhas')::jsonb) where linha = 2), 'ja_cadastrada', 'phone already registered');
select is((select situacao from public.classificar_linhas_importacao(current_setting('t.linhas')::jsonb) where linha = 3), 'nova', 'new phone is new');
select is((select situacao from public.classificar_linhas_importacao(current_setting('t.linhas')::jsonb) where linha = 4), 'repetida_no_arquivo', 'same phone later in the file is a repeat');
select is((select situacao from public.classificar_linhas_importacao(current_setting('t.linhas')::jsonb) where linha = 5), 'ja_cadastrada', 'e-mail match ignores case');
select is((select situacao from public.classificar_linhas_importacao(current_setting('t.linhas')::jsonb) where linha = 6), 'nova', 'name-only row is new');
select is((select situacao from public.classificar_linhas_importacao(current_setting('t.linhas')::jsonb) where linha = 7), 'repetida_no_arquivo', 'name-only repeat ignores case and accents');

-- Import
select set_config('t.res', public.importar_clientes('clientes.xlsx', repeat('a', 64), current_setting('t.linhas')::jsonb)::text, true);
select is((current_setting('t.res')::jsonb ->> 'criados')::int, 3, 'creates the new rows only');
select is((current_setting('t.res')::jsonb ->> 'ignoradas')::int, 4, 'reports the skipped rows');
select is((select count(*) from public.clientes), 5::bigint, 'agency now has the old and the new clients');
select is((select count(*) from public.clientes where importacao_id is not null), 3::bigint, 'imported clients are linked to the import');
select is((select cidade || '|' || origem::text || '|' || qtd_pessoas || '|' || array_to_string(destinos_interesse, ',') || '|' || aniversario || '|' || consentimento_whatsapp::text
           from public.clientes where nome = 'Carlos'), 'Santos|instagram|2|Lisboa,Paris|1990-05-17|aceitou', 'row fields are stored');
select isnt((select consentimento_em from public.clientes where nome = 'Carlos'), null, 'consent date is stamped on import');
select is((select count(*) from public.etiquetas), 2::bigint, 'tags are created once, ignoring case');
select is((select count(*) from public.cliente_etiquetas ce join public.clientes c on c.id = ce.cliente_id where c.nome = 'Dora'), 2::bigint, 'tags are linked to the client');
select is((select total_linhas || '/' || qtd_criados || '/' || qtd_ignorados from public.importacoes), '7/3/4', 'import summary is stored');

-- Guards
select throws_ok($$select public.importar_clientes('de novo.xlsx', repeat('a', 64), '[{"linha":2,"nome":"Zed"}]'::jsonb)$$, '23505', null, 'the same file cannot be imported twice');
select throws_ok($$select public.importar_clientes('grande.xlsx', repeat('b', 64), (select jsonb_agg(jsonb_build_object('linha', i, 'nome', 'N' || i)) from generate_series(1, 5001) i))$$, '22023', null, 'more than 5000 rows is refused');
select throws_ok($$select public.importar_clientes('ruim.xlsx', repeat('c', 64), '[{"linha":2,"nome":"   "}]'::jsonb)$$, '23514', null, 'invalid data aborts the whole import');
select is((select count(*) from public.importacoes), 1::bigint, 'a failed import leaves nothing behind');

-- Isolation
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.importacoes), 0::bigint, 'other agencies do not see the import');
select is((select situacao from public.classificar_linhas_importacao('[{"linha":2,"nome":"Ana Souza","whatsapp":"5511999990001"}]'::jsonb)), 'nova', 'duplicates are checked only inside the own agency');
select lives_ok($$delete from public.importacoes$$, 'another agency''s delete touches nothing (proved by the undo below)');

-- Undo as A
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
delete from public.importacoes;
select is((select count(*) from public.clientes), 2::bigint, 'undo removes the imported clients and keeps the others');
select is((select count(*) from public.cliente_etiquetas), 0::bigint, 'undo removes the tag links');
select lives_ok($$select public.importar_clientes('clientes.xlsx', repeat('a', 64), '[{"linha":2,"nome":"Zed"}]'::jsonb)$$, 'the same file can be imported again after undo');

reset role;
set local role anon;
select throws_ok($$select public.importar_clientes('x', repeat('a', 64), '[]'::jsonb)$$, '42501', null, 'anon cannot import');

select * from finish();
rollback;
