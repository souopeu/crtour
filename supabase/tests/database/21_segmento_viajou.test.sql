begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', '{"agencia_nome":"Alfa","nome":"Dona Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', '{"agencia_nome":"Beta"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('t.beta', (select agencia_id::text from public.membros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);

insert into public.clientes (id, agencia_id, nome) values
  ('a1000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Tito Titular'),
  ('a1000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Ana Acompanhante'),
  ('a1000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'Fred Futuro'),
  ('a1000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'Caio Cancelado'),
  ('a1000000-0000-0000-0000-000000000005', current_setting('t.alfa')::uuid, 'Otto Porto'),
  ('b1000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Beta Lisboa');
insert into public.passeios (id, agencia_id, nome, destino) values
  ('a5000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'Clássicos de Portugal', 'Lisboa'),
  ('a5000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'Porto e vinhos', null),
  ('b5000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'Lisboa Beta', 'Lisboa');
insert into public.saidas (id, agencia_id, passeio_id, data, capacidade, preco_centavos) values
  ('a6000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', current_date - 30, 10, 1000),
  ('a6000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000001', current_date + 30, 10, 1000),
  ('a6000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a5000000-0000-0000-0000-000000000002', current_date - 30, 10, 1000),
  ('b6000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b5000000-0000-0000-0000-000000000001', current_date - 30, 10, 1000);
insert into public.reservas (id, agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, situacao) values
  ('a7000000-0000-0000-0000-000000000001', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2, 2000, 'ativa'),
  ('a7000000-0000-0000-0000-000000000002', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 1, 1000, 'ativa'),
  ('a7000000-0000-0000-0000-000000000003', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', 1, 1000, 'cancelada'),
  ('a7000000-0000-0000-0000-000000000004', current_setting('t.alfa')::uuid, 'a6000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000005', 1, 1000, 'ativa'),
  ('b7000000-0000-0000-0000-000000000001', current_setting('t.beta')::uuid, 'b6000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 1, 1000, 'ativa');
insert into public.passageiros (agencia_id, reserva_id, nome, cliente_id) values
  (current_setting('t.alfa')::uuid, 'a7000000-0000-0000-0000-000000000001', 'Ana Acompanhante', 'a1000000-0000-0000-0000-000000000002');

create function public.tmp_nomes(p jsonb) returns text language sql as $f$
  select coalesce(string_agg(nome, ',' order by nome), '') from public.clientes_do_segmento(p) $f$;
grant execute on function public.tmp_nomes(jsonb) to authenticated;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.tmp_nomes('{"viajouPara":"lisboa"}'), 'Ana Acompanhante,Tito Titular', 'travelled to Lisboa: holder and linked companion; not future, cancelled or other agency');
select is(public.tmp_nomes('{"viajouPara":"PORTUGAL"}'), 'Ana Acompanhante,Tito Titular', 'matches the tour name too, ignoring case');
select is(public.tmp_nomes('{"viajouPara":"porto"}'), 'Otto Porto', 'tour without destination matches by name');
select is(public.tmp_nomes('{"viajouPara":"lis%"}'), '', 'the text is literal, not a pattern');
select is(public.tmp_nomes('{"viajouPara":"lisboa","destino":"x"}'), '', 'combines with the other criteria (AND)');

-- R43: criteria can be edited
insert into public.segmentos (agencia_id, nome, criterios) values (current_setting('t.alfa')::uuid, 'Quem foi a Lisboa', '{"viajouPara":"lisboa"}');
select lives_ok($$update public.segmentos set criterios = '{"viajouPara":"porto"}' where nome = 'Quem foi a Lisboa'$$, 'criteria of a saved segment can be edited');
select is((select criterios->>'viajouPara' from public.segmentos), 'porto', 'new criteria saved');
select throws_ok($$update public.segmentos set criterios = '"x"'$$, '23514', null, 'criteria must stay a JSON object');

select * from finish();
rollback;
