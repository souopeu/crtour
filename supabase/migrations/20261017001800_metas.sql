-- E3-6: monthly revenue goal (counts only effective revenue: deals won in the month). Owner sets it; everyone sees it.
create table public.metas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos < 100000000000),
  atualizado_por uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  unique (agencia_id, mes)
);

revoke all on public.metas from anon, authenticated;
grant select, delete on public.metas to authenticated;
grant insert (agencia_id, mes, valor_centavos) on public.metas to authenticated;
grant update (valor_centavos) on public.metas to authenticated;

alter table public.metas enable row level security;
create policy metas_select on public.metas for select to authenticated using (private.e_membro(agencia_id));
create policy metas_insert on public.metas for insert to authenticated with check (private.e_dono(agencia_id));
create policy metas_update on public.metas for update to authenticated using (private.e_dono(agencia_id)) with check (private.e_dono(agencia_id));
create policy metas_delete on public.metas for delete to authenticated using (private.e_dono(agencia_id));
