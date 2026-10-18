-- Display names: members get a name (from signup, fallback: e-mail prefix);
-- notes keep a snapshot of the author's name, stamped server-side.
alter table public.membros add column nome text;
update public.membros m
  set nome = coalesce(nullif(split_part(u.email, '@', 1), ''), 'Usuário')
  from auth.users u where u.id = m.user_id;
alter table public.membros
  alter column nome set not null,
  add constraint membros_nome_check check (char_length(btrim(nome)) between 1 and 80);

create or replace function private.criar_agencia_do_novo_usuario() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia_id uuid;
begin
  insert into public.agencias (nome)
  values (coalesce(nullif(btrim(left(new.raw_user_meta_data ->> 'agencia_nome', 120)), ''), 'Minha agência'))
  returning id into v_agencia_id;

  insert into public.membros (user_id, agencia_id, papel, nome)
  values (
    new.id, v_agencia_id, 'dono',
    coalesce(
      nullif(btrim(left(new.raw_user_meta_data ->> 'nome', 80)), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Usuário'
    )
  );
  return new;
end;
$$;

alter table public.anotacoes add column autor_nome text;
update public.anotacoes a
  set autor_nome = coalesce((select m.nome from public.membros m where m.user_id = a.autor_id), 'Usuário');
alter table public.anotacoes alter column autor_nome set not null;

create or replace function private.preparar_anotacao() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.autor_id := coalesce((select auth.uid()), new.autor_id);
  new.autor_nome := coalesce(
    (select m.nome from public.membros m where m.user_id = (select auth.uid())),
    new.autor_nome,
    'Usuário'
  );
  new.criada_em := now();
  return new;
end;
$$;
