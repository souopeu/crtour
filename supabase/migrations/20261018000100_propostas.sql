-- E5-6 (R69, R70): proposal made from a deal. The values are frozen in `dados` when it is created;
-- the client opens it by a random link while it is valid and not revoked.

alter table public.passeios
  add column inclui text check (char_length(inclui) <= 2000),
  add column nao_inclui text check (char_length(nao_inclui) <= 2000);
grant update (inclui, nao_inclui) on public.passeios to authenticated;

create table public.propostas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  negociacao_id uuid not null,
  codigo text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_') check (codigo ~ '^[A-Za-z0-9_-]{24}$'),
  dados jsonb not null check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) <= 20000),
  validade date not null,
  criada_por uuid default auth.uid() references auth.users (id) on delete set null,
  criada_em timestamptz not null default now(),
  enviada_em timestamptz,
  revogada_em timestamptz,
  foreign key (negociacao_id, agencia_id) references public.negociacoes (id, agencia_id) on delete cascade
);
create index propostas_negociacao_idx on public.propostas (negociacao_id, criada_em desc);

-- Members create and mark sent/revoked; nobody can choose the code or change the frozen values.
revoke all on public.propostas from anon, authenticated;
grant select on public.propostas to authenticated;
grant insert (agencia_id, negociacao_id, dados, validade) on public.propostas to authenticated;
grant update (enviada_em, revogada_em) on public.propostas to authenticated;
alter table public.propostas enable row level security;
create policy propostas_select on public.propostas for select to authenticated using (private.e_membro(agencia_id));
create policy propostas_insert on public.propostas for insert to authenticated with check (private.e_membro(agencia_id));
create policy propostas_update on public.propostas for update to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));

-- The client's page: only the snapshot, and only while valid (Brazil date) and not revoked.
create function public.proposta_publica(p_codigo text) returns table (dados jsonb, validade date)
  language sql stable security definer set search_path = '' as $$
  select p.dados, p.validade from public.propostas p
  where p.codigo = p_codigo and p.revogada_em is null and p.validade >= private.hoje()
$$;
revoke all on function public.proposta_publica(text) from public;
grant execute on function public.proposta_publica(text) to anon, authenticated;
