begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- R96: each lead of a campaign is sold, lost or still open; the three parts add up to the leads.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.hoje', (now() at time zone 'America/Sao_Paulo')::date::text, true);
insert into public.formularios_publicos (agencia_id, codigo, ativo, titulo) values (current_setting('t.alfa')::uuid, 'AbCdEfGhIjKlMnOpQrStUvWx', true, 'Fale conosco');

-- Four leads of the same campaign through the public form
select public.enviar_formulario_publico('AbCdEfGhIjKlMnOpQrStUvWx', 'v' || i, 'Lead ' || i, '551199999000' || i, null, null, null, null, false, 'anuncio', 'google', 'Inverno')
  from generate_series(1, 4) i;
-- 1 sold, 2 lost, 3 open, 4 lost once but with a newer open deal (still open)
update public.negociacoes n set etapa = 'pago', valor_centavos = 100000 from public.clientes c where c.id = n.cliente_id and c.nome = 'Lead 1';
update public.negociacoes n set etapa = 'perdido', motivo_perda = 'achou_caro' from public.clientes c where c.id = n.cliente_id and c.nome in ('Lead 2', 'Lead 4');
insert into public.negociacoes (agencia_id, cliente_id, titulo)
  select current_setting('t.alfa')::uuid, id, 'Nova tentativa' from public.clientes where nome = 'Lead 4';

-- Not identified: one client with only a lost deal, one with no deal at all
insert into public.clientes (agencia_id, nome) values (current_setting('t.alfa')::uuid, 'Direto 1'), (current_setting('t.alfa')::uuid, 'Direto 2');
insert into public.negociacoes (agencia_id, cliente_id, titulo, etapa, motivo_perda)
  select current_setting('t.alfa')::uuid, id, 'Perdida', 'perdido', 'sem_resposta' from public.clientes where nome = 'Direto 1';

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select leads || '/' || vendas || '/' || perdidos || '/' || em_aberto
           from public.resultado_campanhas(current_setting('t.hoje')::date - 1, current_setting('t.hoje')::date) where chave = 'inverno'),
  '4/1/1/2', 'sold, lost and open per campaign; a newer open deal keeps the lead open');
select is((select bool_and(vendas + perdidos + em_aberto = leads) from public.resultado_campanhas(current_setting('t.hoje')::date - 1, current_setting('t.hoje')::date)),
  true, 'the three parts always add up to the leads');
select is((select leads || '/' || vendas || '/' || perdidos || '/' || em_aberto
           from public.resultado_campanhas(current_setting('t.hoje')::date - 1, current_setting('t.hoje')::date) where chave is null),
  '2/0/1/1', '"not identified" is split the same way (a client with no deal is open)');
select is((select perdidos || '/' || em_aberto from public.resultado_campanhas(current_setting('t.hoje')::date + 1, current_setting('t.hoje')::date + 2) where chave = 'inverno'),
  null, 'no leads in the period, no row for an unregistered campaign');
select is((select valor_vendido_centavos from public.resultado_campanhas(current_setting('t.hoje')::date - 1, current_setting('t.hoje')::date) where chave = 'inverno'),
  100000::bigint, 'the sold value is unchanged');
reset role;

select * from finish();
rollback;
