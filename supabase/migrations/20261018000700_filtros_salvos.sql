-- Saved filters (E6-3, R82/R83): each person keeps up to 20 per screen (Funil, Clientes), private to
-- them (the owner does not see the seller's). `parametros` is the screen's query string; the app
-- always re-reads it through the screen's own URL reader before using it.
create table public.filtros_salvos (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tela text not null check (tela in ('funil', 'clientes')),
  nome text not null check (char_length(btrim(nome)) between 1 and 40),
  parametros text not null default '' check (char_length(parametros) <= 500),
  criado_em timestamptz not null default now()
);
create unique index filtros_salvos_nome_idx on public.filtros_salvos (user_id, tela, lower(btrim(nome)));

create function private.limitar_filtros_salvos() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.filtros_salvos f where f.user_id = new.user_id and f.tela = new.tela) >= 20 then
    raise exception 'Limite de 20 filtros nesta tela' using errcode = 'CR020';
  end if;
  return new;
end;
$$;
create trigger limitar_filtros_salvos before insert on public.filtros_salvos
  for each row execute function private.limitar_filtros_salvos();

alter table public.filtros_salvos enable row level security;
revoke all on public.filtros_salvos from anon, authenticated;
grant select, delete on public.filtros_salvos to authenticated;
grant insert (agencia_id, user_id, tela, nome, parametros) on public.filtros_salvos to authenticated;
grant update (nome) on public.filtros_salvos to authenticated;

create policy filtros_salvos_select on public.filtros_salvos for select to authenticated
  using (user_id = (select auth.uid()) and private.e_membro(agencia_id));
create policy filtros_salvos_insert on public.filtros_salvos for insert to authenticated
  with check (user_id = (select auth.uid()) and private.e_membro(agencia_id));
create policy filtros_salvos_update on public.filtros_salvos for update to authenticated
  using (user_id = (select auth.uid()) and private.e_membro(agencia_id))
  with check (user_id = (select auth.uid()) and private.e_membro(agencia_id));
create policy filtros_salvos_delete on public.filtros_salvos for delete to authenticated
  using (user_id = (select auth.uid()) and private.e_membro(agencia_id));
