-- Clients, tags and notes. Every table carries agencia_id; composite foreign keys
-- (id, agencia_id) make it impossible to link rows from different agencies.
create type public.origem_lead as enum ('instagram', 'indicacao', 'anuncio', 'site', 'outro');
create type public.consentimento_whatsapp as enum ('aceitou', 'nao_informado', 'pediu_saida');

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 200),
  whatsapp text check (whatsapp ~ '^[0-9]{10,15}$'),
  email text check (char_length(email) <= 254),
  cidade text check (char_length(cidade) <= 120),
  aniversario date,
  origem public.origem_lead,
  destinos_interesse text[] not null default '{}' check (cardinality(destinos_interesse) <= 30),
  faixa_orcamento text check (char_length(faixa_orcamento) <= 60),
  qtd_pessoas integer check (qtd_pessoas between 1 and 500),
  restricoes text check (char_length(restricoes) <= 2000),
  passaporte_validade date, -- validity only; the passport number is deliberately not stored (LGPD)
  consentimento_whatsapp public.consentimento_whatsapp not null default 'nao_informado',
  consentimento_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, agencia_id)
);
create index clientes_agencia_nome_idx on public.clientes (agencia_id, lower(nome));

create table public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 40),
  cor text not null default '#1d4ed8' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  unique (id, agencia_id)
);
create unique index etiquetas_nome_unico on public.etiquetas (agencia_id, lower(nome));

create table public.cliente_etiquetas (
  cliente_id uuid not null,
  etiqueta_id uuid not null,
  agencia_id uuid not null,
  primary key (cliente_id, etiqueta_id),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id) on delete cascade,
  foreign key (etiqueta_id, agencia_id) references public.etiquetas (id, agencia_id) on delete cascade
);
create index cliente_etiquetas_etiqueta_idx on public.cliente_etiquetas (etiqueta_id);

create table public.anotacoes (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  cliente_id uuid not null,
  autor_id uuid references auth.users (id) on delete set null,
  texto text not null check (char_length(btrim(texto)) between 1 and 4000),
  criada_em timestamptz not null default now(),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id) on delete cascade
);
create index anotacoes_cliente_idx on public.anotacoes (cliente_id, criada_em desc);

-- Server-side stamps: creator/author come from the session (never from the client);
-- the consent date is set whenever the consent value changes.
create function private.preparar_cliente() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce((select auth.uid()), new.criado_por);
    new.criado_em := now();
    if new.consentimento_whatsapp <> 'nao_informado' then
      new.consentimento_em := now();
    end if;
  else
    if new.consentimento_whatsapp is distinct from old.consentimento_whatsapp then
      new.consentimento_em := case when new.consentimento_whatsapp = 'nao_informado' then null else now() end;
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger preparar_cliente before insert or update on public.clientes
  for each row execute function private.preparar_cliente();

create function private.preparar_anotacao() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.autor_id := coalesce((select auth.uid()), new.autor_id);
  new.criada_em := now();
  return new;
end;
$$;
create trigger preparar_anotacao before insert on public.anotacoes
  for each row execute function private.preparar_anotacao();

-- Privileges: no anon access; updates exclude ownership columns.
revoke all on public.clientes, public.etiquetas, public.cliente_etiquetas, public.anotacoes from anon, authenticated;
grant select, insert, delete on public.clientes, public.etiquetas, public.cliente_etiquetas, public.anotacoes to authenticated;
grant update (nome, whatsapp, email, cidade, aniversario, origem, destinos_interesse, faixa_orcamento,
  qtd_pessoas, restricoes, passaporte_validade, consentimento_whatsapp) on public.clientes to authenticated;
grant update (nome, cor) on public.etiquetas to authenticated;

alter table public.clientes enable row level security;
alter table public.etiquetas enable row level security;
alter table public.cliente_etiquetas enable row level security;
alter table public.anotacoes enable row level security;

create policy clientes_all on public.clientes
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy etiquetas_all on public.etiquetas
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy cliente_etiquetas_all on public.cliente_etiquetas
  for all to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));

create policy anotacoes_select on public.anotacoes
  for select to authenticated using (private.e_membro(agencia_id));
create policy anotacoes_insert on public.anotacoes
  for insert to authenticated with check (private.e_membro(agencia_id));
-- Authors delete their own notes; owners can delete any note of the agency.
create policy anotacoes_delete on public.anotacoes
  for delete to authenticated using (
    private.e_membro(agencia_id) and (autor_id = (select auth.uid()) or private.e_dono(agencia_id))
  );
