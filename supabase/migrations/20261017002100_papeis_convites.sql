-- E3-7 (R41): the owner invites sellers by link; the owner can remove them.
-- The link carries a random token; only its SHA-256 is stored. Joining needs token AND e-mail.

create table public.convites (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+$'),
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  token_hash text not null check (char_length(token_hash) between 1 and 128),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days', -- mirror: src/lib/equipe/config.ts
  aceito_em timestamptz
);
create unique index convites_pendente_unico on public.convites (agencia_id, email) where aceito_em is null;
create index convites_token_idx on public.convites (token_hash);

revoke all on public.convites from anon, authenticated;
grant select, delete on public.convites to authenticated;
grant insert (agencia_id, email, nome, token_hash) on public.convites to authenticated;
alter table public.convites enable row level security;
create policy convites_select on public.convites for select to authenticated using (private.e_dono(agencia_id));
create policy convites_insert on public.convites for insert to authenticated with check (private.e_dono(agencia_id));
create policy convites_delete on public.convites for delete to authenticated using (private.e_dono(agencia_id));

create function private.convite_valido(p_token text, p_email text) returns public.convites
  language sql stable security definer set search_path = '' as $$
  select c.* from public.convites c
  where c.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and c.email = lower(btrim(p_email)) and c.aceito_em is null and c.expira_em > now()
  order by c.criado_em desc limit 1
$$;
revoke all on function private.convite_valido(text, text) from public, anon, authenticated;

-- Lets the signup form say "invalid or expired link" before creating the account. A yes/no on a random token reveals nothing.
create function public.verificar_convite(p_token text, p_email text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select (private.convite_valido(p_token, p_email)).id is not null
$$;
revoke all on function public.verificar_convite(text, text) from public;
grant execute on function public.verificar_convite(text, text) to anon, authenticated;

create or replace function private.criar_agencia_do_novo_usuario() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia_id uuid;
  v_convite public.convites;
  v_nome text := coalesce(
    nullif(btrim(left(new.raw_user_meta_data ->> 'nome', 80)), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Usuário');
begin
  if new.raw_user_meta_data ? 'convite' then
    v_convite := private.convite_valido(new.raw_user_meta_data ->> 'convite', new.email);
    if v_convite.id is null then
      raise exception 'Convite inválido ou vencido' using errcode = 'CR011'; -- never fall back to a new agency
    end if;
    insert into public.membros (user_id, agencia_id, papel, nome) values (new.id, v_convite.agencia_id, 'vendedor', v_nome);
    update public.convites set aceito_em = now() where id = v_convite.id;
    return new;
  end if;

  insert into public.agencias (nome)
  values (coalesce(nullif(btrim(left(new.raw_user_meta_data ->> 'agencia_nome', 120)), ''), 'Minha agência'))
  returning id into v_agencia_id;
  insert into public.membros (user_id, agencia_id, papel, nome) values (new.id, v_agencia_id, 'dono', v_nome);
  return new;
end;
$$;

-- Owner removes a seller: her deals and activities stay, without a person in charge. Her login stays, with no agency.
create function public.remover_membro(p_user uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
begin
  select m.agencia_id into v_agencia from public.membros m where m.user_id = p_user and m.papel = 'vendedor';
  if v_agencia is null or not private.e_dono(v_agencia) then
    raise exception 'Só o dono remove vendedores da própria agência' using errcode = '42501';
  end if;
  update public.negociacoes set responsavel_id = null where agencia_id = v_agencia and responsavel_id = p_user;
  update public.atividades set responsavel_id = null where agencia_id = v_agencia and responsavel_id = p_user;
  delete from public.membros where user_id = p_user and agencia_id = v_agencia;
end;
$$;
revoke all on function public.remover_membro(uuid) from public, anon;
grant execute on function public.remover_membro(uuid) to authenticated;
