-- Tours (passeios) and departures (saidas) with capacity. Reservations come in the next slice.
create type public.situacao_saida as enum ('aberta', 'encerrada', 'cancelada');

create table public.passeios (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  destino text check (char_length(destino) <= 120),
  descricao text check (char_length(descricao) <= 1000),
  arquivado boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (id, agencia_id)
);
create index passeios_agencia_idx on public.passeios (agencia_id, arquivado, lower(nome));

create table public.saidas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  passeio_id uuid not null,
  data date not null,
  capacidade integer not null check (capacidade between 1 and 500),
  preco_centavos integer not null check (preco_centavos between 0 and 1000000000), -- per person, in cents
  situacao public.situacao_saida not null default 'aberta',
  criado_em timestamptz not null default now(),
  unique (id, agencia_id),
  -- RESTRICT: a tour with departures is archived, never deleted
  foreign key (passeio_id, agencia_id) references public.passeios (id, agencia_id) on delete restrict
);
create index saidas_agencia_data_idx on public.saidas (agencia_id, data);
create index saidas_passeio_idx on public.saidas (passeio_id, data);

revoke all on public.passeios, public.saidas from anon, authenticated;
grant select, insert, delete on public.passeios, public.saidas to authenticated;
grant update (nome, destino, descricao, arquivado) on public.passeios to authenticated;
grant update (data, capacidade, preco_centavos, situacao) on public.saidas to authenticated;

alter table public.passeios enable row level security;
alter table public.saidas enable row level security;
create policy passeios_all on public.passeios
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy saidas_all on public.saidas
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
