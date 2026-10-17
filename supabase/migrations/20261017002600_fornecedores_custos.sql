-- E4-4 (R51–R53): suppliers and costs per departure (margin = sold − costs).
create type public.tipo_fornecedor as enum ('transporte', 'hospedagem', 'guia', 'ingresso', 'alimentacao', 'outro');

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  tipo public.tipo_fornecedor not null default 'outro',
  contato text check (char_length(contato) <= 200),
  criado_em timestamptz not null default now(),
  unique (id, agencia_id)
);
create index fornecedores_agencia_idx on public.fornecedores (agencia_id, lower(nome));

create table public.custos_saida (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  saida_id uuid not null,
  fornecedor_id uuid,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  valor_centavos integer not null check (valor_centavos between 1 and 1000000000),
  vencimento date,
  pago_em date, -- null = still to pay
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  foreign key (saida_id, agencia_id) references public.saidas (id, agencia_id) on delete cascade,
  foreign key (fornecedor_id, agencia_id) references public.fornecedores (id, agencia_id) on delete set null (fornecedor_id)
);
create index custos_saida_saida_idx on public.custos_saida (saida_id);

revoke all on public.fornecedores, public.custos_saida from anon, authenticated;
grant select, insert, delete on public.fornecedores to authenticated;
grant update (nome, tipo, contato) on public.fornecedores to authenticated;
grant select, delete on public.custos_saida to authenticated;
grant insert (agencia_id, saida_id, fornecedor_id, descricao, valor_centavos, vencimento, pago_em) on public.custos_saida to authenticated;
grant update (fornecedor_id, descricao, valor_centavos, vencimento, pago_em) on public.custos_saida to authenticated;

alter table public.fornecedores enable row level security;
alter table public.custos_saida enable row level security;
create policy fornecedores_select on public.fornecedores for select to authenticated using (private.e_membro(agencia_id));
create policy fornecedores_insert on public.fornecedores for insert to authenticated with check (private.e_membro(agencia_id));
create policy fornecedores_update on public.fornecedores for update to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy fornecedores_delete on public.fornecedores for delete to authenticated using (private.e_dono(agencia_id)); -- R51: only the owner deletes
create policy custos_select on public.custos_saida for select to authenticated using (private.e_membro(agencia_id));
create policy custos_insert on public.custos_saida for insert to authenticated with check (private.e_membro(agencia_id));
create policy custos_update on public.custos_saida for update to authenticated using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy custos_delete on public.custos_saida for delete to authenticated using (private.e_membro(agencia_id));
