begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Spec 19, R102–R103: the inbox list by tab, with search, tag filter, tags, stage, who handles it and counters.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', '{}');
delete from public.agencias where id = (select agencia_id from public.membros where user_id = 'cccccccc-0000-0000-0000-000000000003');
insert into public.membros (user_id, agencia_id, papel, nome)
  select 'cccccccc-0000-0000-0000-000000000003', agencia_id, 'vendedor', 'Vendedora C' from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
insert into public.clientes (id, agencia_id, nome, whatsapp) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Ana Souza', '5511999990001'),
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Bia Lima', '5511999990002'),
  ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Caio Reis', '5511999990003'),
  ('a1000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'Duda Melo', '5511999990004');
insert into public.etiquetas (id, agencia_id, nome, cor) values ('e1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Europa', '#0f7b5f');
insert into public.cliente_etiquetas (cliente_id, etiqueta_id, agencia_id) values ('a1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid);
insert into public.negociacoes (agencia_id, cliente_id, titulo, etapa) values (current_setting('t.alfa')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Lisboa', 'orcamento');
insert into public.canais_whatsapp (agencia_id, provedor, conta) values (current_setting('t.alfa')::uuid, 'falso', 'num-alfa');

set local role service_role;
select public.whatsapp_receber('falso', 'num-alfa', 'w' || i, '551199999000' || i, null, 'Oi ' || i, now() - make_interval(mins => 10 - i)) from generate_series(1, 4) i;
select public.whatsapp_registrar_envio('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'falso', 'e1', 'Olá, Ana!', null);
reset role;
-- Bia handled by C, Caio by the owner, Duda archived
update public.conversas set responsavel_id = 'cccccccc-0000-0000-0000-000000000003' where cliente_id = 'a1000000-0000-0000-0000-000000000002';
update public.conversas set responsavel_id = 'aaaaaaaa-0000-0000-0000-000000000001' where cliente_id = 'a1000000-0000-0000-0000-000000000003';
update public.conversas set situacao = 'arquivada' where cliente_id = 'a1000000-0000-0000-0000-000000000004';

create function pg_temp.nomes(p_aba text, p_busca text default null, p_etiqueta uuid default null) returns text language sql as $$
  select coalesce(string_agg(cliente_nome, ',' order by cliente_nome), '') from public.listar_conversas(p_aba, p_busca, p_etiqueta);
$$;

-- The owner
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(pg_temp.nomes('novos'), 'Ana Souza', 'Novos: no one handles it');
select is(pg_temp.nomes('meus'), 'Caio Reis', 'Meus: handled by me');
select is(pg_temp.nomes('outros'), 'Bia Lima', 'Outros: handled by someone else');
select is(pg_temp.nomes('arquivadas'), 'Duda Melo', 'Arquivadas: archived, whoever handles it');
select is((select etiquetas->0->>'nome' || '|' || (etiquetas->0->>'cor') || '|' || etapa::text || '|' || ultima_direcao::text || '|' || ultima_previa
           from public.listar_conversas('novos')), 'Europa|#0f7b5f|orcamento|enviada|Olá, Ana!', 'an item carries tags with color, the open stage and the last message');
select is((select responsavel_nome from public.listar_conversas('outros')), 'Vendedora C', 'and who handles it');
select is(pg_temp.nomes('novos', 'ana'), 'Ana Souza', 'search by name, ignoring case');
select is(pg_temp.nomes('outros', '9 9999-0002'), 'Bia Lima', 'search by phone digits');
select is(pg_temp.nomes('novos', 'zzz'), '', 'a search that matches nothing');
select is(pg_temp.nomes('novos', null, 'e1000000-0000-0000-0000-000000000001'), 'Ana Souza', 'filter by tag');
select is((select string_agg(aba || ':' || conversas || '/' || com_nao_lidas, ',' order by aba) from public.contar_conversas()),
  'arquivadas:1/1,meus:1/1,novos:1/1,outros:1/1', 'counters per tab: conversations and those with unread messages');
select throws_ok($$select * from public.listar_conversas('todas')$$, '22023', null, 'an unknown tab is refused');
reset role;

-- The seller: no "Outros", her own in "Meus"
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(pg_temp.nomes('meus'), 'Bia Lima', 'a seller sees her own in Meus');
select is(pg_temp.nomes('outros'), '', 'and nothing in Outros');
reset role;

-- Another agency
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(pg_temp.nomes('novos') || pg_temp.nomes('arquivadas'), '', 'another agency sees nothing');
select is((select coalesce(sum(conversas), 0) from public.contar_conversas()), 0::numeric, 'nor counts anything');
reset role;

select * from finish();
rollback;
