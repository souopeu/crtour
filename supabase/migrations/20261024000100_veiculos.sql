-- E9-2 (R137–R138): the agency's vehicles, and vehicle + time on each departure.
create type public.categoria_veiculo as enum ('van', 'onibus', 'micro_onibus', 'buggy', 'barco', 'carro', 'outro');

create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  categoria public.categoria_veiculo not null default 'van',
  lugares integer not null check (lugares between 1 and 500),
  arquivado boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (id, agencia_id)
);
create index veiculos_agencia_idx on public.veiculos (agencia_id, arquivado, lower(nome));

revoke all on public.veiculos from anon, authenticated;
grant select, insert, delete on public.veiculos to authenticated;
grant update (nome, categoria, lugares, arquivado) on public.veiculos to authenticated;
alter table public.veiculos enable row level security;
create policy veiculos_select on public.veiculos for select to authenticated using (private.e_membro(agencia_id));
create policy veiculos_insert on public.veiculos for insert to authenticated with check (private.e_membro(agencia_id));
create policy veiculos_update on public.veiculos for update to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy veiculos_delete on public.veiculos for delete to authenticated using (private.e_dono(agencia_id)); -- same rule as suppliers

-- A vehicle in use cannot be deleted (archive it instead); a departure only uses a vehicle of its own agency.
alter table public.saidas
  add column horario time,
  add column veiculo_id uuid,
  add foreign key (veiculo_id, agencia_id) references public.veiculos (id, agencia_id) on delete restrict;
create index saidas_veiculo_idx on public.saidas (veiculo_id) where veiculo_id is not null;
grant update (horario, veiculo_id) on public.saidas to authenticated;

-- R138: with a vehicle, the departure never sells more places than it has seats (capacity ≤ seats).
-- CR003 (capacity ≥ seats sold) keeps working as before, so together the people always fit in the vehicle.
-- Another agency's vehicle is not looked at here: the foreign key refuses it.
create function private.saida_cabe_no_veiculo() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.veiculo_id is not null and new.capacidade > (select v.lugares from public.veiculos v where v.id = new.veiculo_id and v.agencia_id = new.agencia_id) then
    raise exception 'A capacidade passa dos lugares do veículo' using errcode = 'CR019';
  end if;
  return new;
end;
$$;
revoke all on function private.saida_cabe_no_veiculo() from public, anon, authenticated;
create trigger saida_cabe_no_veiculo before insert or update of capacidade, veiculo_id on public.saidas
  for each row execute function private.saida_cabe_no_veiculo();

create function private.veiculo_cabe_nas_saidas() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.saidas s where s.veiculo_id = new.id and s.capacidade > new.lugares) then
    raise exception 'Há saídas com mais vagas do que estes lugares' using errcode = 'CR019';
  end if;
  return new;
end;
$$;
revoke all on function private.veiculo_cabe_nas_saidas() from public, anon, authenticated;
create trigger veiculo_cabe_nas_saidas before update of lugares on public.veiculos
  for each row when (new.lugares < old.lugares) execute function private.veiculo_cabe_nas_saidas();

-- Departure lists read time and vehicle from the seats view too (new columns at the end).
create or replace view public.v_saidas_vagas with (security_invoker = true) as
select s.id, s.agencia_id, s.passeio_id, s.data, s.capacidade, s.preco_centavos, s.situacao,
       coalesce(sum(r.qtd_pessoas) filter (where r.situacao = 'ativa'), 0)::int as reservadas,
       (s.capacidade - coalesce(sum(r.qtd_pessoas) filter (where r.situacao = 'ativa'), 0))::int as livres,
       s.horario, s.veiculo_id
from public.saidas s
left join public.reservas r on r.saida_id = s.id
group by s.id;
