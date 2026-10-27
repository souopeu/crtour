-- E11-1 (R155–R156): departures in batch and price/capacity in batch.
-- The app builds the list of dates (weekdays in a period); the database creates them, skipping a date and time
-- that already has a departure. Changing price never touches reservations: their total is stored on them.
-- New error: CR022 archived or one-off tour.

create function public.criar_saidas_lote(
  p_passeio uuid, p_datas date[], p_horarios time[], p_capacidade integer, p_preco integer, p_veiculo uuid default null
) returns table (criadas integer, puladas integer)
  language plpgsql security definer set search_path = '' as $$
declare
  v_passeio public.passeios;
  v_total integer := coalesce(cardinality(p_datas), 0) * greatest(coalesce(cardinality(p_horarios), 0), 1);
begin
  -- Locks the tour so two batches at the same time cannot both create the same date and time.
  select p.* into v_passeio from public.passeios p where p.id = p_passeio for update;
  if not found or not private.e_membro(v_passeio.agencia_id) then
    raise exception 'Passeio não encontrado' using errcode = '42501';
  end if;
  if v_passeio.arquivado or v_passeio.sob_medida then
    raise exception 'Este passeio não recebe saídas em lote' using errcode = 'CR022';
  end if;
  if v_total < 1 or v_total > 500 then
    raise exception 'Escolha de 1 a 500 saídas por vez' using errcode = '22023';
  end if;

  -- capacity, price and vehicle are checked by the table (checks, CR019 trigger, composite foreign key)
  insert into public.saidas (agencia_id, passeio_id, data, horario, capacidade, preco_centavos, veiculo_id)
  select v_passeio.agencia_id, p_passeio, d, h, p_capacidade, p_preco, p_veiculo
  from (select distinct unnest(p_datas) as d) datas
  cross join (select distinct unnest(coalesce(nullif(p_horarios, '{}'), array[null::time])) as h) horarios
  where not exists (
    select 1 from public.saidas s where s.passeio_id = p_passeio and s.data = datas.d and s.horario is not distinct from horarios.h
  );
  get diagnostics criadas = row_count;
  puladas := (select count(*) from (select distinct unnest(p_datas)) a)
           * (select count(*) from (select distinct unnest(coalesce(nullif(p_horarios, '{}'), array[null::time]))) b) - criadas;
  return next;
end;
$$;

-- Returns the departures left out and why ('passada', '42501', 'CR003', 'CR019'); the others are changed.
create function public.alterar_saidas_lote(p_saidas uuid[], p_preco integer default null, p_capacidade integer default null)
  returns table (saida_id uuid, motivo text)
  language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_saida public.saidas;
begin
  if p_preco is null and p_capacidade is null then
    raise exception 'Informe o novo preço ou as novas vagas' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_saidas), 0) not between 1 and 500 then
    raise exception 'Escolha de 1 a 500 saídas por vez' using errcode = '22023';
  end if;

  foreach v_id in array p_saidas loop
    select s.* into v_saida from public.saidas s where s.id = v_id for update;
    if not found or not private.e_membro(v_saida.agencia_id) then
      saida_id := v_id; motivo := '42501'; return next; continue;
    end if;
    if v_saida.data < private.hoje() then
      saida_id := v_id; motivo := 'passada'; return next; continue;
    end if;
    begin
      update public.saidas
      set preco_centavos = coalesce(p_preco, preco_centavos), capacidade = coalesce(p_capacidade, capacidade)
      where id = v_id;
    exception when sqlstate 'CR003' or sqlstate 'CR019' then
      saida_id := v_id; motivo := sqlstate; return next;
    end;
  end loop;
end;
$$;

revoke all on function public.criar_saidas_lote(uuid, date[], time[], integer, integer, uuid),
  public.alterar_saidas_lote(uuid[], integer, integer) from public, anon;
grant execute on function public.criar_saidas_lote(uuid, date[], time[], integer, integer, uuid),
  public.alterar_saidas_lote(uuid[], integer, integer) to authenticated;
