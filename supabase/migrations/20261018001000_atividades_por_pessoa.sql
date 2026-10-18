-- Activities per person (spec 18, R88/R89): for the owner only, in one month (Brazil time).
-- Per member: activities done by type and in total, overdue pending ones (as of now) and deals won
-- in the month. The person is whoever is in charge, or the creator when nobody is (spec 18 ⚠️).
-- SECURITY INVOKER plus an explicit owner check: a seller gets an error, never her colleagues' numbers.
create function public.atividades_por_pessoa(p_mes text)
  returns table (pessoa_id uuid, nome text, ligacao integer, whatsapp integer, email integer, reuniao integer,
                 tarefa integer, feitas integer, atrasadas integer, ganhas integer)
  language plpgsql stable security invoker set search_path = '' as $$
declare
  v_agencia uuid;
  v_inicio date;
  v_fim date;
begin
  if p_mes is null or p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mês inválido' using errcode = '22023';
  end if;
  select m.agencia_id into v_agencia from public.membros m where m.user_id = (select auth.uid()) limit 1;
  if v_agencia is null or not private.e_dono(v_agencia) then
    raise exception 'Só o dono da agência vê este relatório' using errcode = '42501';
  end if;
  v_inicio := (p_mes || '-01')::date;
  v_fim := (v_inicio + interval '1 month')::date;

  return query
  with feitas as (
    select coalesce(a.responsavel_id, a.criado_por) as p, a.tipo
    from public.atividades a
    where a.agencia_id = v_agencia and a.status = 'feito'
      and (a.feito_em at time zone 'America/Sao_Paulo')::date >= v_inicio
      and (a.feito_em at time zone 'America/Sao_Paulo')::date < v_fim
  ), atrasadas as (
    select coalesce(a.responsavel_id, a.criado_por) as p, count(*)::integer as n
    from public.atividades a
    where a.agencia_id = v_agencia and a.status = 'pendente' and a.quando < now()
    group by 1
  ), ganhas as (
    select coalesce(n.responsavel_id, n.criado_por) as p, count(*)::integer as n
    from public.negociacoes n
    where n.agencia_id = v_agencia and private.etapa_ganha(n.etapa) and n.fechado_em >= v_inicio and n.fechado_em < v_fim
    group by 1
  ), pessoas as (
    -- members always; anyone else with numbers (e.g. a removed person) too
    select m.user_id as p from public.membros m where m.agencia_id = v_agencia
    union select f.p from feitas f union select a.p from atrasadas a union select g.p from ganhas g
  )
  select ps.p, coalesce(m.nome, case when ps.p is null then 'Sem responsável' else 'Pessoa removida' end),
    (select count(*) from feitas f where f.p is not distinct from ps.p and f.tipo = 'ligacao')::integer,
    (select count(*) from feitas f where f.p is not distinct from ps.p and f.tipo = 'whatsapp')::integer,
    (select count(*) from feitas f where f.p is not distinct from ps.p and f.tipo = 'email')::integer,
    (select count(*) from feitas f where f.p is not distinct from ps.p and f.tipo = 'reuniao')::integer,
    (select count(*) from feitas f where f.p is not distinct from ps.p and f.tipo = 'tarefa')::integer,
    (select count(*) from feitas f where f.p is not distinct from ps.p)::integer,
    coalesce((select a.n from atrasadas a where a.p is not distinct from ps.p), 0),
    coalesce((select g.n from ganhas g where g.p is not distinct from ps.p), 0)
  from pessoas ps
  left join public.membros m on m.user_id = ps.p and m.agencia_id = v_agencia
  order by m.nome nulls last;
end;
$$;

revoke all on function public.atividades_por_pessoa(text) from public, anon;
grant execute on function public.atividades_por_pessoa(text) to authenticated;
