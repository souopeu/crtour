-- Payment receipts (spec 18, R93–R95): one file per payment, in a PRIVATE bucket.
-- Files live at <agencia>/<pagamento>/<id>.<ext>; storage policies keep each agency in its own folder,
-- and the app only ever hands out short-lived signed links. Personal documents are not allowed (LGPD).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 4194304, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy comprovantes_ler on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes'
         and (storage.foldername(name))[1] in (select m.agencia_id::text from public.membros m where m.user_id = (select auth.uid())));
create policy comprovantes_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes'
              and array_length(storage.foldername(name), 1) = 2
              and (storage.foldername(name))[1] in (select m.agencia_id::text from public.membros m where m.user_id = (select auth.uid())));
create policy comprovantes_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes'
         and (storage.foldername(name))[1] in (select m.agencia_id::text from public.membros m where m.user_id = (select auth.uid())));

create table public.comprovantes (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  pagamento_id uuid not null unique,
  caminho text not null unique,
  tipo text not null check (tipo in ('application/pdf', 'image/jpeg', 'image/png')),
  tamanho integer not null check (tamanho between 1 and 4194304),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  foreign key (pagamento_id, agencia_id) references public.pagamentos (id, agencia_id) on delete cascade,
  check (caminho like agencia_id::text || '/' || pagamento_id::text || '/%')
);

alter table public.comprovantes enable row level security;
revoke all on public.comprovantes from anon, authenticated;
grant select, delete on public.comprovantes to authenticated;
grant insert (agencia_id, pagamento_id, caminho, tipo, tamanho) on public.comprovantes to authenticated;
grant update (caminho, tipo, tamanho) on public.comprovantes to authenticated;

create policy comprovantes_select on public.comprovantes for select to authenticated using (private.e_membro(agencia_id));
create policy comprovantes_insert on public.comprovantes for insert to authenticated with check (private.e_membro(agencia_id));
create policy comprovantes_update on public.comprovantes for update to authenticated
  using (private.e_membro(agencia_id)) with check (private.e_membro(agencia_id));
create policy comprovantes_delete on public.comprovantes for delete to authenticated using (private.e_membro(agencia_id));
