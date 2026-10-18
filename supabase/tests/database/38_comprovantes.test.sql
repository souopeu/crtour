begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Users: A (owner, Alfa), B (owner, Beta), C (seller, Alfa)
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias
  where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C'
  from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana');
insert into public.passeios (id, agencia_id, nome) values ('a4000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Gramado');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a4000000-0000-0000-0000-000000000001', '2030-11-10', 10, 100000);
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 100000);
insert into public.pagamentos (id, agencia_id, reserva_id, valor_centavos, tipo, data) values
  ('a7000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 50000, 'sinal', '2030-10-01');
select set_config('t.pasta', current_setting('t.alfa') || '/a7000000-0000-0000-0000-000000000001/', true);

create function public.tmp_rows_affected(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function public.tmp_rows_affected(text) to authenticated;

select ok((select not public from storage.buckets where id = 'comprovantes'), 'bucket exists and is private');
select is((select file_size_limit from storage.buckets where id = 'comprovantes'), 4194304::bigint, 'bucket limits files to 4 MB');
select is((select allowed_mime_types from storage.buckets where id = 'comprovantes'), array['application/pdf', 'image/jpeg', 'image/png'], 'only PDF, JPEG and PNG');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- Files: only under one's own agency folder
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('comprovantes', %L)$$, current_setting('t.pasta') || 'x.pdf'), 'member uploads under her agency folder');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('comprovantes', %L)$$, current_setting('t.beta') || '/p/x.pdf'), '42501', null, 'cannot upload into another agency folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('comprovantes', 'solto/x.pdf')$$, '42501', null, 'cannot upload outside an agency folder');

-- Row that links the file to the payment
select lives_ok(format($$insert into public.comprovantes (agencia_id, pagamento_id, caminho, tipo, tamanho) values (%L, 'a7000000-0000-0000-0000-000000000001', %L, 'application/pdf', 1000)$$, current_setting('t.alfa'), current_setting('t.pasta') || 'x.pdf'), 'member links the receipt to the payment');
select throws_ok(format($$insert into public.comprovantes (agencia_id, pagamento_id, caminho, tipo, tamanho) values (%L, 'a7000000-0000-0000-0000-000000000001', %L, 'application/pdf', 1000)$$, current_setting('t.alfa'), current_setting('t.pasta') || 'y.pdf'), '23505', null, 'one receipt per payment');
select throws_ok(format($$update public.comprovantes set caminho = %L$$, current_setting('t.beta') || '/a7000000-0000-0000-0000-000000000001/z.pdf'), '23514', null, 'path must sit under its agency and payment');
select throws_ok(format($$update public.comprovantes set tipo = 'text/html'$$), '23514', null, 'only allowed types');

reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'comprovantes'), 1::bigint, 'seller of the same agency sees the file');
select is((select count(*) from public.comprovantes), 1::bigint, 'seller sees the receipt row');

reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'comprovantes'), 0::bigint, 'other agency never sees the file');
select is(public.tmp_rows_affected($$delete from public.comprovantes$$), 0::bigint, 'other agency cannot unlink it');

reset role;
set local role anon;
select is((select count(*) from storage.objects where bucket_id = 'comprovantes'), 0::bigint, 'anon sees no files');

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_rows_affected($$delete from public.comprovantes$$), 1::bigint, 'member removes the link');

reset role;
select * from finish();
rollback;
