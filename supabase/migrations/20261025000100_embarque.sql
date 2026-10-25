-- E9-4 (R141): boarding and attendance list per departure.
-- One row per person on board: the responsible client (passageiro_id null, vaga 0), a named companion
-- (passageiro_id set, vaga 0) or a place still without a name (passageiro_id null, vaga 1…qtd-1).
alter table public.saidas add column embarque_iniciado_em timestamptz;

create table public.embarques (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  reserva_id uuid not null,
  passageiro_id uuid references public.passageiros (id) on delete cascade,
  vaga smallint not null default 0 check (vaga between 0 and 499),
  embarcou_em timestamptz not null default now(),
  marcado_por uuid default auth.uid() references auth.users (id) on delete set null,
  check (passageiro_id is null or vaga = 0),
  foreign key (reserva_id, agencia_id) references public.reservas (id, agencia_id) on delete cascade
);
create unique index embarques_pessoa_idx on public.embarques
  (reserva_id, coalesce(passageiro_id, '00000000-0000-0000-0000-000000000000'::uuid), vaga);

revoke all on public.embarques from anon, authenticated;
grant select on public.embarques to authenticated;
alter table public.embarques enable row level security;
create policy embarques_select on public.embarques for select to authenticated using (private.e_membro(agencia_id));

-- Starting the boarding (again is harmless): ready reservations become "em execução".
create function public.iniciar_embarque(p_saida uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_saida public.saidas;
begin
  select s.* into v_saida from public.saidas s where s.id = p_saida for update;
  if not found or not private.e_membro(v_saida.agencia_id) then
    raise exception 'Saída não encontrada' using errcode = '42501';
  end if;
  if v_saida.situacao = 'cancelada' then
    raise exception 'A saída está cancelada' using errcode = 'CR002';
  end if;
  update public.saidas set embarque_iniciado_em = coalesce(embarque_iniciado_em, now()) where id = p_saida;
  update public.reservas set status_operacional = 'em_execucao', status_operacional_em = now()
  where saida_id = p_saida and situacao = 'ativa' and status_operacional = 'pronta';
end;
$$;

-- Mark or unmark one person. Marking twice or unmarking someone not on board changes nothing.
create function public.marcar_embarque(p_reserva uuid, p_passageiro uuid, p_vaga integer, p_embarcou boolean)
  returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reserva public.reservas;
  v_nomeados integer;
begin
  select r.* into v_reserva from public.reservas r where r.id = p_reserva for update;
  if not found or not private.e_membro(v_reserva.agencia_id) then
    raise exception 'Reserva não encontrada' using errcode = '42501';
  end if;
  if v_reserva.situacao <> 'ativa' then
    raise exception 'A reserva está cancelada' using errcode = 'CR006';
  end if;
  if (select s.embarque_iniciado_em from public.saidas s where s.id = v_reserva.saida_id) is null then
    raise exception 'Inicie o embarque desta saída primeiro' using errcode = 'CR021';
  end if;

  if p_passageiro is not null then
    if p_vaga <> 0 or not exists (select 1 from public.passageiros p where p.id = p_passageiro and p.reserva_id = p_reserva) then
      raise exception 'Passageiro não é desta reserva' using errcode = '22023';
    end if;
  else
    select count(*) into v_nomeados from public.passageiros p where p.reserva_id = p_reserva;
    -- vaga 0 = the responsible client; 1…(qtd-1-named) = the places still without a name
    if p_vaga is null or p_vaga < 0 or p_vaga > v_reserva.qtd_pessoas - 1 - v_nomeados then
      raise exception 'Lugar inexistente nesta reserva' using errcode = '22023';
    end if;
  end if;

  if coalesce(p_embarcou, false) then
    insert into public.embarques (agencia_id, reserva_id, passageiro_id, vaga)
    values (v_reserva.agencia_id, p_reserva, p_passageiro, coalesce(p_vaga, 0))
    on conflict (reserva_id, coalesce(passageiro_id, '00000000-0000-0000-0000-000000000000'::uuid), vaga) do nothing;
  else
    delete from public.embarques e
    where e.reserva_id = p_reserva and e.passageiro_id is not distinct from p_passageiro and e.vaga = coalesce(p_vaga, 0);
  end if;
end;
$$;

revoke all on function public.iniciar_embarque(uuid), public.marcar_embarque(uuid, uuid, integer, boolean) from public, anon;
grant execute on function public.iniciar_embarque(uuid), public.marcar_embarque(uuid, uuid, integer, boolean) to authenticated;

-- Lists read the boarding start from the seats view too (new column at the end).
create or replace view public.v_saidas_vagas with (security_invoker = true) as
select s.id, s.agencia_id, s.passeio_id, s.data, s.capacidade, s.preco_centavos, s.situacao,
       coalesce(sum(r.qtd_pessoas) filter (where r.situacao = 'ativa'), 0)::int as reservadas,
       (s.capacidade - coalesce(sum(r.qtd_pessoas) filter (where r.situacao = 'ativa'), 0))::int as livres,
       s.horario, s.veiculo_id, s.embarque_iniciado_em
from public.saidas s
left join public.reservas r on r.saida_id = s.id
group by s.id;
