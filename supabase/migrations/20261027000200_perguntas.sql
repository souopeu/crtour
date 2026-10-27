-- E11-3 (R160–R161): questions asked before the tour ("Hotel para busca", "Peso") and answers on the reservation.
-- A per-passenger answer is tied to the place in the reservation (1 = responsible, 2… = companions in list order),
-- since names may not exist yet when selling. Answers keep the question text, so deleting a question keeps them.
-- New errors: CR025 more than 10 questions on a tour, CR026 invalid answer.

create type public.tipo_pergunta as enum ('texto', 'sim_nao', 'escolha', 'numero');

create table public.passeio_perguntas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  passeio_id uuid not null,
  texto text not null check (char_length(btrim(texto)) between 1 and 200),
  tipo public.tipo_pergunta not null default 'texto',
  opcoes text[] check (opcoes is null or (cardinality(opcoes) between 2 and 10 and array_position(opcoes, null) is null)),
  obrigatoria boolean not null default false,
  por_passageiro boolean not null default false,
  ordem smallint not null default 0,
  criado_em timestamptz not null default now(),
  check (tipo <> 'escolha' or opcoes is not null),
  foreign key (passeio_id, agencia_id) references public.passeios (id, agencia_id) on delete cascade
);
create index passeio_perguntas_passeio_idx on public.passeio_perguntas (passeio_id, ordem);

create table public.reserva_respostas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  reserva_id uuid not null,
  pergunta_id uuid references public.passeio_perguntas (id) on delete set null,
  lugar smallint check (lugar between 1 and 500),     -- null = answer for the whole reservation
  pergunta_texto text not null,
  resposta text not null check (char_length(resposta) between 1 and 500),
  respondida_em timestamptz not null default now(),
  foreign key (reserva_id, agencia_id) references public.reservas (id, agencia_id) on delete cascade
);
create index reserva_respostas_reserva_idx on public.reserva_respostas (reserva_id);

revoke all on public.passeio_perguntas, public.reserva_respostas from anon, authenticated;
grant select, insert, update, delete on public.passeio_perguntas to authenticated;
grant select on public.reserva_respostas to authenticated;
alter table public.passeio_perguntas enable row level security;
alter table public.reserva_respostas enable row level security;
create policy passeio_perguntas_all on public.passeio_perguntas
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy reserva_respostas_select on public.reserva_respostas
  for select to authenticated using (private.e_membro(agencia_id));

-- At most 10 questions per tour; the tour row lock makes two inserts at once count each other.
create function private.limitar_perguntas() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.passeios where id = new.passeio_id for update;
  if (select count(*) from public.passeio_perguntas where passeio_id = new.passeio_id) >= 10 then
    raise exception 'Um passeio tem no máximo 10 perguntas' using errcode = 'CR025';
  end if;
  return new;
end;
$$;
revoke all on function private.limitar_perguntas() from public, anon, authenticated;
create trigger limitar_perguntas before insert on public.passeio_perguntas
  for each row execute function private.limitar_perguntas();

-- Answers [{"pergunta": uuid, "lugar": n (per passenger only), "resposta": text}]; an empty answer clears it.
create function public.responder_reserva(p_reserva uuid, p_respostas jsonb) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_reserva public.reservas;
  v_passeio uuid;
  v_item jsonb;
  v_pergunta public.passeio_perguntas;
  v_lugar integer;
  v_resposta text;
begin
  select r.* into v_reserva from public.reservas r where r.id = p_reserva for update;
  if not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  if v_reserva.situacao <> 'ativa' then
    raise exception 'A reserva está cancelada' using errcode = 'CR006';
  end if;
  select s.passeio_id into v_passeio from public.saidas s where s.id = v_reserva.saida_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_respostas, '[]')) loop
    select q.* into v_pergunta from public.passeio_perguntas q
    where q.id = (v_item->>'pergunta')::uuid and q.passeio_id = v_passeio;
    if not found then
      raise exception 'Pergunta de outro passeio' using errcode = 'CR026';
    end if;
    v_lugar := (v_item->>'lugar')::int;
    if v_pergunta.por_passageiro is distinct from (v_lugar is not null) or v_lugar not between 1 and v_reserva.qtd_pessoas then
      raise exception 'Lugar inválido para esta pergunta' using errcode = 'CR026';
    end if;
    v_resposta := btrim(coalesce(v_item->>'resposta', ''));
    if v_resposta <> '' and (
      char_length(v_resposta) > 500
      or (v_pergunta.tipo = 'sim_nao' and v_resposta not in ('Sim', 'Não'))
      or (v_pergunta.tipo = 'escolha' and not v_resposta = any (v_pergunta.opcoes))
      or (v_pergunta.tipo = 'numero' and v_resposta !~ '^-?[0-9]{1,9}([.,][0-9]{1,3})?$')
    ) then
      raise exception 'Resposta inválida para "%"', v_pergunta.texto using errcode = 'CR026';
    end if;

    delete from public.reserva_respostas
    where reserva_id = p_reserva and pergunta_id = v_pergunta.id and lugar is not distinct from v_lugar;
    if v_resposta <> '' then
      insert into public.reserva_respostas (agencia_id, reserva_id, pergunta_id, lugar, pergunta_texto, resposta)
      values (v_reserva.agencia_id, p_reserva, v_pergunta.id, v_lugar, v_pergunta.texto, v_resposta);
    end if;
  end loop;
end;
$$;
revoke all on function public.responder_reserva(uuid, jsonb) from public, anon;
grant execute on function public.responder_reserva(uuid, jsonb) to authenticated;
