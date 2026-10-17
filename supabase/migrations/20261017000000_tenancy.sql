-- Tenancy: one agency per account, users belong to an agency with a role.
create schema if not exists private;

create type public.papel_membro as enum ('dono', 'vendedor');

create table public.agencias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  criada_em timestamptz not null default now()
);

create table public.membros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  papel public.papel_membro not null default 'vendedor',
  criado_em timestamptz not null default now()
);
create index membros_agencia_id_idx on public.membros (agencia_id);

-- Helpers used by every RLS policy. SECURITY DEFINER so they can read membros
-- without recursing into its own policies; search_path is pinned.
create function private.e_membro(p_agencia_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros
    where user_id = (select auth.uid()) and agencia_id = p_agencia_id
  );
$$;

create function private.e_dono(p_agencia_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros
    where user_id = (select auth.uid()) and agencia_id = p_agencia_id and papel = 'dono'
  );
$$;

-- On signup: create the agency and make the new user its owner.
create function private.criar_agencia_do_novo_usuario() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia_id uuid;
begin
  insert into public.agencias (nome)
  values (coalesce(nullif(btrim(left(new.raw_user_meta_data ->> 'agencia_nome', 120)), ''), 'Minha agência'))
  returning id into v_agencia_id;

  insert into public.membros (user_id, agencia_id, papel)
  values (new.id, v_agencia_id, 'dono');
  return new;
end;
$$;

create trigger criar_agencia_ao_cadastrar
  after insert on auth.users
  for each row execute function private.criar_agencia_do_novo_usuario();

-- Privileges: the app never writes these tables directly (only the trigger does).
revoke all on function private.criar_agencia_do_novo_usuario() from public, anon, authenticated;
revoke all on function private.e_membro(uuid), private.e_dono(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.e_membro(uuid), private.e_dono(uuid) to authenticated;

revoke all on public.agencias, public.membros from anon, authenticated;
grant select on public.agencias, public.membros to authenticated;
grant update (nome) on public.agencias to authenticated;

alter table public.agencias enable row level security;
alter table public.membros enable row level security;

create policy agencias_select on public.agencias
  for select to authenticated using (private.e_membro(id));
create policy agencias_update on public.agencias
  for update to authenticated using (private.e_dono(id)) with check (private.e_dono(id));

create policy membros_select on public.membros
  for select to authenticated using (private.e_membro(agencia_id));
