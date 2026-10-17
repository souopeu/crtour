-- E4-3 (R48–R50): commission. The agency picks one of three rules; only the owner configures it.
create type public.regra_comissao as enum ('percentual_vendedor', 'percentual_passeio', 'valor_por_pessoa');

alter table public.agencias add column regra_comissao public.regra_comissao; -- null = commission not used
grant update (nome, dias_sem_contato, dias_negociacao_parada, regra_comissao) on public.agencias to authenticated;

alter table public.membros add column comissao_percentual numeric(5,2) not null default 0 check (comissao_percentual between 0 and 100);
grant update (comissao_percentual) on public.membros to authenticated;
create policy membros_update_dono on public.membros for update to authenticated
  using (private.e_dono(agencia_id)) with check (private.e_dono(agencia_id));

alter table public.passeios
  add column comissao_percentual numeric(5,2) not null default 0 check (comissao_percentual between 0 and 100),
  add column comissao_por_pessoa_centavos integer not null default 0 check (comissao_por_pessoa_centavos between 0 and 100000000);
grant update (comissao_percentual, comissao_por_pessoa_centavos) on public.passeios to authenticated;

-- Members edit tours, but only the owner changes their commission.
create function private.proteger_comissao_passeio() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if (new.comissao_percentual, new.comissao_por_pessoa_centavos) is distinct from (old.comissao_percentual, old.comissao_por_pessoa_centavos)
     and not private.e_dono(new.agencia_id) then
    raise exception 'Só o dono muda a comissão do passeio' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.proteger_comissao_passeio() from public, anon, authenticated;
create trigger proteger_comissao_passeio before update on public.passeios for each row execute function private.proteger_comissao_passeio();

-- Who sold the reservation: whoever created it, unless the owner says otherwise. Removing the person keeps the reservation.
alter table public.reservas add column vendedor_id uuid;
alter table public.reservas add constraint reservas_vendedor_fk
  foreign key (vendedor_id, agencia_id) references public.membros (user_id, agencia_id) on delete set null (vendedor_id);
update public.reservas r set vendedor_id = r.criada_por
  where exists (select 1 from public.membros m where m.user_id = r.criada_por and m.agencia_id = r.agencia_id);

create function private.vendedor_padrao() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.vendedor_id is null and exists (select 1 from public.membros m where m.user_id = new.criada_por and m.agencia_id = new.agencia_id) then
    new.vendedor_id := new.criada_por;
  end if;
  return new;
end;
$$;
revoke all on function private.vendedor_padrao() from public, anon, authenticated;
create trigger vendedor_padrao before insert on public.reservas for each row execute function private.vendedor_padrao();

create function public.definir_vendedor_reserva(p_reserva uuid, p_vendedor uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
begin
  select r.agencia_id into v_agencia from public.reservas r where r.id = p_reserva;
  if v_agencia is null or not private.e_dono(v_agencia) then
    raise exception 'Só o dono muda quem vendeu' using errcode = '42501';
  end if;
  update public.reservas set vendedor_id = p_vendedor where id = p_reserva; -- the composite FK refuses someone of another agency (23503)
end;
$$;
revoke all on function public.definir_vendedor_reserva(uuid, uuid) from public, anon;
grant execute on function public.definir_vendedor_reserva(uuid, uuid) to authenticated;

-- R50: commission is due in the month the reservation became fully paid (last time the running total reached it,
-- in payment-date order). A refund that reopens the balance removes it until it is paid again. Cancelled never counts.
-- Owner sees everyone; a seller sees only her own.
create function public.comissoes_do_mes(p_mes date)
returns table (reserva_id uuid, vendedor_id uuid, cliente_id uuid, saida_id uuid, qtd_pessoas integer, valor_total_centavos integer, quitada_em date, comissao_centavos integer)
  language sql stable security invoker set search_path = '' as $$
  with mov as (
    select p.reserva_id, p.data, p.criado_em,
      case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end as v,
      sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end)
        over (partition by p.reserva_id order by p.data, p.criado_em, p.id rows unbounded preceding) as acum
    from public.pagamentos p
  ), quit as (
    select r.id,
      max(m.data) filter (where m.acum >= r.valor_total_centavos and m.acum - m.v < r.valor_total_centavos) as quitada_em,
      sum(m.v) as pago
    from public.reservas r join mov m on m.reserva_id = r.id
    where r.situacao = 'ativa' and r.valor_total_centavos > 0
    group by r.id
  )
  select r.id, r.vendedor_id, r.cliente_id, r.saida_id, r.qtd_pessoas, r.valor_total_centavos, q.quitada_em,
    (case a.regra_comissao
      when 'percentual_vendedor' then round(r.valor_total_centavos * coalesce(m.comissao_percentual, 0) / 100)
      when 'percentual_passeio' then round(r.valor_total_centavos * ps.comissao_percentual / 100)
      else r.qtd_pessoas::numeric * ps.comissao_por_pessoa_centavos end)::int
  from quit q
  join public.reservas r on r.id = q.id
  join public.agencias a on a.id = r.agencia_id and a.regra_comissao is not null
  join public.saidas s on s.id = r.saida_id
  join public.passeios ps on ps.id = s.passeio_id
  left join public.membros m on m.user_id = r.vendedor_id and m.agencia_id = r.agencia_id
  where q.pago >= r.valor_total_centavos
    and q.quitada_em >= p_mes and q.quitada_em < (p_mes + interval '1 month')::date
    and (private.e_dono(r.agencia_id) or r.vendedor_id = (select auth.uid()))
  order by q.quitada_em, r.id
$$;
revoke all on function public.comissoes_do_mes(date) from public, anon;
grant execute on function public.comissoes_do_mes(date) to authenticated;
