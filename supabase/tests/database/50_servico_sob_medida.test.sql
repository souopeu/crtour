begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- E9-5 (R142): a tailor-made service is a hidden tour + one departure + the reservation, in one step.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000501', 'sob-a@test.dev', '{"agencia_nome":"Alfa sob medida"}'),
  ('bbbbbbbb-0000-0000-0000-000000000502', 'sob-b@test.dev', '{"agencia_nome":"Beta sob medida"}');
select set_config('t.alfa', (select agencia_id::text from public.membros where user_id = 'aaaaaaaa-0000-0000-0000-000000000501'), true);
insert into public.clientes (id, agencia_id, nome) values ('a1000000-0000-0000-0000-000000000501', current_setting('t.alfa')::uuid, 'Ana Sob Medida');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000501","role":"authenticated"}', true);
set local role authenticated;

select set_config('t.reserva', public.criar_servico_sob_medida(
  'a1000000-0000-0000-0000-000000000501', 'Transfer aeroporto + hotel', '2027-10-05', '06:30', 3, 45000, 'Voo 1234')::text, true);
select is((select qtd_pessoas from public.reservas where id = current_setting('t.reserva')::uuid), 3, 'the reservation has the people');
select is((select valor_total_centavos from public.reservas where id = current_setting('t.reserva')::uuid), 45000, 'and the agreed total, not price × people');
select is((select observacao from public.reservas where id = current_setting('t.reserva')::uuid), 'Voo 1234', 'and the note');
select is((select status_operacional::text from public.reservas where id = current_setting('t.reserva')::uuid), 'a_definir', 'it starts "a definir" like any reservation');
select is(
  (select s.data::text || ' ' || s.horario::text || ' ' || s.capacidade from public.saidas s join public.reservas r on r.saida_id = s.id where r.id = current_setting('t.reserva')::uuid),
  '2027-10-05 06:30:00 3', 'its departure has the date, the time and exactly the seats sold');
select ok((select p.sob_medida and p.nome = 'Transfer aeroporto + hotel' from public.passeios p join public.saidas s on s.passeio_id = p.id join public.reservas r on r.saida_id = s.id
  where r.id = current_setting('t.reserva')::uuid), 'the tour is marked as tailor-made');
select is((select count(*) from public.busca_global('Transfer aeroporto') where tipo = 'passeio'), 0::bigint, 'the global search does not list it as a tour');

select throws_ok($$select public.criar_servico_sob_medida('a1000000-0000-0000-0000-000000000501', '  ', '2027-10-05', null, 1, 100, null)$$, '22023', null, 'a name is required');
select throws_ok($$select public.criar_servico_sob_medida('a1000000-0000-0000-0000-000000000501', 'X', '2027-10-05', null, 0, 100, null)$$, '22023', null, 'at least one person');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000502","role":"authenticated"}', true);
select throws_ok($$select public.criar_servico_sob_medida('a1000000-0000-0000-0000-000000000501', 'Intruso', '2027-10-05', null, 1, 100, null)$$, '42501', null, 'not for a client of another agency');
select is((select count(*) from public.passeios where nome = 'Intruso'), 0::bigint, 'and nothing is left behind');

select * from finish();
rollback;
