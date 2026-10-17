-- E3-8 (automation 6): reservations suggest moving a deal (Reservado / Pago) with one tap; never automatically.
-- Suggestions are computed on read; only "Agora não" is stored, so a dismissed one does not come back.
create table public.sugestoes_dispensadas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  negociacao_id uuid not null,
  reserva_id uuid not null,
  para public.etapa_negociacao not null check (para in ('reservado', 'pago')),
  dispensada_por uuid default auth.uid() references auth.users (id) on delete set null,
  dispensada_em timestamptz not null default now(),
  unique (negociacao_id, reserva_id, para),
  foreign key (negociacao_id, agencia_id) references public.negociacoes (id, agencia_id) on delete cascade,
  foreign key (reserva_id, agencia_id) references public.reservas (id, agencia_id) on delete cascade
);

revoke all on public.sugestoes_dispensadas from anon, authenticated;
grant select on public.sugestoes_dispensadas to authenticated;
grant insert (agencia_id, negociacao_id, reserva_id, para) on public.sugestoes_dispensadas to authenticated;
alter table public.sugestoes_dispensadas enable row level security;
create policy sugestoes_dispensadas_select on public.sugestoes_dispensadas for select to authenticated using (private.e_membro(agencia_id));
create policy sugestoes_dispensadas_insert on public.sugestoes_dispensadas for insert to authenticated with check (private.e_membro(agencia_id));
