-- E8-7 (R131): Web Push. One row per device that asked for notices; each person manages only their own.
create table public.inscricoes_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  criado_em timestamptz not null default now(),
  foreign key (user_id, agencia_id) references public.membros (user_id, agencia_id) on delete cascade
);
revoke all on public.inscricoes_push from anon, authenticated;
grant select, insert, delete on public.inscricoes_push to authenticated;
alter table public.inscricoes_push enable row level security;
create policy inscricoes_push_proprias on public.inscricoes_push for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.e_membro(agencia_id));

-- A notice is pushed once; older than 1 hour and still unsent means the clock was down: not worth a late buzz.
alter table public.avisos add column push_enviado_em timestamptz;
create index avisos_push_pendente_idx on public.avisos (criado_em) where push_enviado_em is null;

-- For the clock (service key only): pending notices × the devices of whoever should get them
-- (the recipient, or every owner when the notice is agency-wide). Marks them as handled in the same call.
create function public.pegar_pushes_pendentes(p_agora timestamptz default now())
  returns table (aviso_id uuid, tipo public.tipo_aviso, titulo text, cliente_nome text, valor_centavos integer,
                 negociacao_id uuid, reserva_id uuid, saida_id uuid, cliente_id uuid,
                 inscricao_id uuid, endpoint text, p256dh text, auth text)
  language plpgsql security definer set search_path = '' as $$
begin
  return query
  with pendentes as (
    update public.avisos a set push_enviado_em = p_agora
    where a.push_enviado_em is null and a.criado_em > p_agora - interval '1 hour'
    returning a.*
  )
  select p.id, p.tipo, p.titulo, p.cliente_nome, p.valor_centavos, p.negociacao_id, p.reserva_id, p.saida_id, at.cliente_id,
         i.id, i.endpoint, i.p256dh, i.auth
  from pendentes p
  left join public.atividades at on at.id = p.atividade_id
  join public.membros m on m.agencia_id = p.agencia_id
    and ((p.para_user_id is null and m.papel = 'dono') or m.user_id = p.para_user_id)
  join public.inscricoes_push i on i.user_id = m.user_id and i.agencia_id = p.agencia_id;
end;
$$;

-- Devices the push service says are gone (404/410) are removed.
create function public.apagar_inscricoes_push(p_ids uuid[]) returns void
  language sql security definer set search_path = '' as $$
  delete from public.inscricoes_push where id = any (p_ids);
$$;

revoke all on function public.pegar_pushes_pendentes(timestamptz), public.apagar_inscricoes_push(uuid[]) from public, anon, authenticated;
grant execute on function public.pegar_pushes_pendentes(timestamptz), public.apagar_inscricoes_push(uuid[]) to service_role;
