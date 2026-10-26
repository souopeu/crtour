-- E10-3 (R151): the owner checks a day's money in and out. Any later change to a movement of that day
-- (payment, refund, bill, departure cost, commission paid) undoes the check and records when, so the screen warns.
create table public.conferencias_dia (
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  dia date not null,
  conferido_por uuid default auth.uid() references auth.users (id) on delete set null,
  conferido_em timestamptz not null default now(),
  observacao text check (char_length(observacao) <= 500),
  invalidada_em timestamptz,
  primary key (agencia_id, dia)
);
revoke all on public.conferencias_dia from anon, authenticated;
grant select on public.conferencias_dia to authenticated;
alter table public.conferencias_dia enable row level security;
create policy conferencias_dia_dono on public.conferencias_dia for select to authenticated using (private.e_dono(agencia_id));

create function public.conferir_dia(p_dia date, p_observacao text) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
begin
  select m.agencia_id into v_agencia from public.membros m where m.user_id = (select auth.uid()) and m.papel = 'dono';
  if v_agencia is null then
    raise exception 'Só o dono confere o caixa' using errcode = '42501';
  end if;
  if p_dia is null or p_dia > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Não dá para conferir um dia que ainda não chegou' using errcode = '22008';
  end if;
  insert into public.conferencias_dia (agencia_id, dia, observacao)
  values (v_agencia, p_dia, nullif(btrim(left(p_observacao, 500)), ''))
  on conflict (agencia_id, dia) do update
    set conferido_por = (select auth.uid()), conferido_em = now(), observacao = excluded.observacao, invalidada_em = null;
end;
$$;
revoke all on function public.conferir_dia(date, text) from public, anon;
grant execute on function public.conferir_dia(date, text) to authenticated;

-- Undo the check of the day(s) a movement belonged to before and after the change.
create function private.desfazer_conferencia() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_antes date;
  v_depois date;
  v_agencia uuid := coalesce(new.agencia_id, old.agencia_id);
begin
  if tg_table_name = 'pagamentos' then
    v_antes := case when tg_op <> 'INSERT' then old.data end;
    v_depois := case when tg_op <> 'DELETE' then new.data end;
  else
    v_antes := case when tg_op <> 'INSERT' then old.pago_em end;
    v_depois := case when tg_op <> 'DELETE' then new.pago_em end;
  end if;
  update public.conferencias_dia set invalidada_em = now()
  where agencia_id = v_agencia and dia in (v_antes, v_depois) and invalidada_em is null;
  return null;
end;
$$;
revoke all on function private.desfazer_conferencia() from public, anon, authenticated;

create trigger pagamentos_conferencia after insert or update or delete on public.pagamentos
  for each row execute function private.desfazer_conferencia();
create trigger contas_pagar_conferencia after insert or update of pago_em, forma_pago, valor_centavos or delete on public.contas_pagar
  for each row execute function private.desfazer_conferencia();
create trigger custos_saida_conferencia after insert or update of pago_em, forma_pago, valor_centavos or delete on public.custos_saida
  for each row execute function private.desfazer_conferencia();
create trigger comissoes_pagas_conferencia after insert or update or delete on public.comissoes_pagas
  for each row execute function private.desfazer_conferencia();
