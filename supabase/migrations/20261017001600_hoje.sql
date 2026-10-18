-- E3-4: "Hoje" screen thresholds, per agency (owner adjusts; defaults to confirm with the client).
alter table public.agencias
  add column dias_sem_contato smallint not null default 30 check (dias_sem_contato between 1 and 365),
  add column dias_negociacao_parada smallint not null default 7 check (dias_negociacao_parada between 1 and 365);

-- Only the owner passes the agencias_update policy, so only the owner changes these.
grant update (nome, dias_sem_contato, dias_negociacao_parada) on public.agencias to authenticated;

-- "Sem contato há X dias" lists clients by last interaction, oldest first.
create index clientes_agencia_interacao_idx on public.clientes (agencia_id, ultima_interacao_em nulls first, criado_em);
