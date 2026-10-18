-- E5-7 (R71, R72): birthday (per client, once a year) and "one year since the trip" (per reservation).
-- Unlike the service messages of E4-5, these are relationship messages: only for who accepted (CR017).

alter table public.agencias
  add column modelo_um_ano text check (char_length(modelo_um_ano) <= 1000),
  add column modelo_aniversario text check (char_length(modelo_aniversario) <= 1000);
grant update (modelo_um_ano, modelo_aniversario) on public.agencias to authenticated;

-- One year since the trip reuses the tour-message queue; it needs consent.
create or replace function private.preparar_mensagem_passeio() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_consentimento public.consentimento_whatsapp;
  v_situacao public.situacao_reserva;
begin
  select c.consentimento_whatsapp, r.situacao into v_consentimento, v_situacao
  from public.reservas r join public.clientes c on c.id = r.cliente_id
  where r.id = new.reserva_id and r.agencia_id = new.agencia_id;
  if v_situacao is distinct from 'ativa' then raise exception 'Reserva cancelada' using errcode = 'CR006'; end if;
  if v_consentimento = 'pediu_saida' then raise exception 'Cliente pediu para não receber mensagens' using errcode = 'CR009'; end if;
  if new.tipo = 'um_ano' and v_consentimento <> 'aceitou' then
    raise exception 'Sem consentimento para mensagem de relacionamento' using errcode = 'CR017';
  end if;
  return new;
end;
$$;

create or replace function public.fila_mensagens_passeio(p_hoje date, p_janela integer)
returns table (reserva_id uuid, tipo public.tipo_mensagem_passeio, cliente_id uuid, saida_id uuid, vendedor_id uuid, saida_data date, saldo_centavos integer)
  language sql stable security invoker set search_path = '' as $$
  with base as (
    select r.id, r.cliente_id, r.saida_id, r.vendedor_id, s.data, a.dias_lembrete, a.dias_avaliacao, c.consentimento_whatsapp,
      (r.valor_total_centavos - coalesce((select sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end) from public.pagamentos p where p.reserva_id = r.id), 0))::int as saldo
    from public.reservas r
    join public.saidas s on s.id = r.saida_id
    join public.agencias a on a.id = r.agencia_id
    join public.clientes c on c.id = r.cliente_id
    where r.situacao = 'ativa' and s.situacao <> 'cancelada'
  ), candidatas as (
    select id, 'confirmacao'::public.tipo_mensagem_passeio as tipo, cliente_id, saida_id, vendedor_id, data, saldo from base where data >= p_hoje
    union all
    select id, 'lembrete', cliente_id, saida_id, vendedor_id, data, saldo from base where p_hoje between data - dias_lembrete and data
    union all
    select id, 'avaliacao', cliente_id, saida_id, vendedor_id, data, saldo from base where p_hoje between data + dias_avaliacao and data + p_janela
    union all
    select id, 'um_ano', cliente_id, saida_id, vendedor_id, data, saldo from base
    where consentimento_whatsapp = 'aceitou' and p_hoje between (data + interval '1 year')::date and (data + interval '1 year')::date + p_janela
  )
  select c.id, c.tipo, c.cliente_id, c.saida_id, c.vendedor_id, c.data, c.saldo
  from candidatas c
  where not exists (select 1 from public.mensagens_passeio_envios e where e.reserva_id = c.id and e.tipo = c.tipo)
  order by c.data, c.tipo, c.id
  limit 500
$$;

create or replace function public.registrar_mensagem_passeio(p_reserva uuid, p_tipo public.tipo_mensagem_passeio, p_mensagem text) returns void
  language plpgsql security invoker set search_path = '' as $$
declare
  v_res public.reservas;
  v_atividade uuid;
  v_envio uuid;
  v_rotulo text := case p_tipo when 'confirmacao' then 'confirmação' when 'lembrete' then 'lembrete' when 'um_ano' then '1 ano da viagem' else 'avaliação' end;
begin
  select * into v_res from public.reservas where id = p_reserva;
  if v_res.id is null then raise exception 'Reserva não encontrada' using errcode = 'P0002'; end if;
  insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status)
  values (v_res.agencia_id, v_res.cliente_id, 'whatsapp',
    left(format('Mensagem do passeio (%s): %s', v_rotulo, left(regexp_replace(btrim(coalesce(p_mensagem, '')), '\s+', ' ', 'g'), 120)), 200), now(), 'feito')
  returning id into v_atividade;
  insert into public.mensagens_passeio_envios (agencia_id, reserva_id, tipo, atividade_id)
  values (v_res.agencia_id, p_reserva, p_tipo, v_atividade)
  on conflict (reserva_id, tipo) do nothing
  returning id into v_envio;
  if v_envio is null then raise exception 'Mensagem já enviada' using errcode = 'CR010'; end if;
end;
$$;

-- Birthdays: one send per client per year.
create table public.mensagens_aniversario (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  cliente_id uuid not null,
  ano smallint not null check (ano between 2000 and 2100),
  atividade_id uuid references public.atividades (id) on delete set null,
  enviado_por uuid default auth.uid() references auth.users (id) on delete set null,
  enviado_em timestamptz not null default now(),
  unique (cliente_id, ano),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id) on delete cascade
);
create index mensagens_aniversario_atividade_idx on public.mensagens_aniversario (atividade_id);

create function private.preparar_aniversario() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if (select c.consentimento_whatsapp from public.clientes c where c.id = new.cliente_id and c.agencia_id = new.agencia_id) is distinct from 'aceitou' then
    raise exception 'Sem consentimento para mensagem de relacionamento' using errcode = 'CR017';
  end if;
  return new;
end;
$$;
revoke all on function private.preparar_aniversario() from public, anon, authenticated;
create trigger preparar_aniversario before insert on public.mensagens_aniversario for each row execute function private.preparar_aniversario();

revoke all on public.mensagens_aniversario from anon, authenticated;
grant select on public.mensagens_aniversario to authenticated;
grant insert (agencia_id, cliente_id, ano, atividade_id) on public.mensagens_aniversario to authenticated;
alter table public.mensagens_aniversario enable row level security;
create policy mensagens_aniversario_select on public.mensagens_aniversario for select to authenticated using (private.e_membro(agencia_id));
create policy mensagens_aniversario_insert on public.mensagens_aniversario for insert to authenticated with check (private.e_membro(agencia_id));

-- From the birthday until p_tolerancia days later (a closed Sunday does not lose it). Feb 29 falls on Feb 28;
-- last year's date is checked too, so a 31/12 birthday still shows on 01/01.
create function public.fila_aniversarios(p_hoje date, p_tolerancia integer)
returns table (cliente_id uuid, dia date, ano integer)
  language sql stable security invoker set search_path = '' as $$
  with datas as (
    select c.id, (c.aniversario + make_interval(years => extract(year from p_hoje)::int + k.k - extract(year from c.aniversario)::int))::date as dia
    from public.clientes c cross join (values (0), (-1)) as k (k)
    where c.aniversario is not null and c.consentimento_whatsapp = 'aceitou'
  )
  select d.id, d.dia, extract(year from d.dia)::int
  from datas d
  where p_hoje between d.dia and d.dia + p_tolerancia
    and not exists (select 1 from public.mensagens_aniversario m where m.cliente_id = d.id and m.ano = extract(year from d.dia))
  order by d.dia, d.id
  limit 500
$$;

create function public.registrar_aniversario(p_cliente uuid, p_ano integer, p_mensagem text) returns void
  language plpgsql security invoker set search_path = '' as $$
declare
  v_agencia uuid;
  v_atividade uuid;
  v_envio uuid;
begin
  select c.agencia_id into v_agencia from public.clientes c where c.id = p_cliente;
  if v_agencia is null then raise exception 'Cliente não encontrado' using errcode = 'P0002'; end if;
  insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status)
  values (v_agencia, p_cliente, 'whatsapp', left('Aniversário: ' || left(regexp_replace(btrim(coalesce(p_mensagem, '')), '\s+', ' ', 'g'), 120), 200), now(), 'feito')
  returning id into v_atividade;
  insert into public.mensagens_aniversario (agencia_id, cliente_id, ano, atividade_id) values (v_agencia, p_cliente, p_ano, v_atividade)
  on conflict (cliente_id, ano) do nothing
  returning id into v_envio;
  if v_envio is null then raise exception 'Mensagem já enviada' using errcode = 'CR010'; end if;
end;
$$;

revoke all on function public.fila_aniversarios(date, integer), public.registrar_aniversario(uuid, integer, text) from public, anon;
grant execute on function public.fila_aniversarios(date, integer), public.registrar_aniversario(uuid, integer, text) to authenticated;
