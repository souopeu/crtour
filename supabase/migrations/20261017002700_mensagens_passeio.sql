-- E4-5 (R54–R56): tour messages queue (confirmation, reminder, review), sent one by one by the person.
create type public.tipo_mensagem_passeio as enum ('confirmacao', 'lembrete', 'avaliacao');

alter table public.agencias
  add column dias_lembrete smallint not null default 2 check (dias_lembrete between 1 and 60),
  add column dias_avaliacao smallint not null default 1 check (dias_avaliacao between 1 and 60),
  add column modelo_confirmacao text check (char_length(modelo_confirmacao) <= 1000), -- null = app default text
  add column modelo_lembrete text check (char_length(modelo_lembrete) <= 1000),
  add column modelo_avaliacao text check (char_length(modelo_avaliacao) <= 1000);
grant update (nome, dias_sem_contato, dias_negociacao_parada, regra_comissao, dias_lembrete, dias_avaliacao,
  modelo_confirmacao, modelo_lembrete, modelo_avaliacao) on public.agencias to authenticated;

create table public.mensagens_passeio_envios (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  reserva_id uuid not null,
  tipo public.tipo_mensagem_passeio not null,
  atividade_id uuid references public.atividades (id) on delete set null,
  enviado_por uuid default auth.uid() references auth.users (id) on delete set null,
  enviado_em timestamptz not null default now(),
  unique (reserva_id, tipo),
  foreign key (reserva_id, agencia_id) references public.reservas (id, agencia_id) on delete cascade
);

-- Service messages: "não informado" may receive them; who asked to leave never does (CR009); cancelled reservation (CR006).
create function private.preparar_mensagem_passeio() returns trigger
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
  return new;
end;
$$;
revoke all on function private.preparar_mensagem_passeio() from public, anon, authenticated;
create trigger preparar_mensagem_passeio before insert on public.mensagens_passeio_envios for each row execute function private.preparar_mensagem_passeio();

revoke all on public.mensagens_passeio_envios from anon, authenticated;
grant select on public.mensagens_passeio_envios to authenticated;
grant insert (agencia_id, reserva_id, tipo, atividade_id) on public.mensagens_passeio_envios to authenticated;
alter table public.mensagens_passeio_envios enable row level security;
create policy mensagens_passeio_select on public.mensagens_passeio_envios for select to authenticated using (private.e_membro(agencia_id));
create policy mensagens_passeio_insert on public.mensagens_passeio_envios for insert to authenticated with check (private.e_membro(agencia_id));

-- The day's queue: confirmation (upcoming trip, not yet confirmed), reminder (from N days before until the day),
-- review (from N days after, within p_janela days). Cancelled reservations and departures are out.
create function public.fila_mensagens_passeio(p_hoje date, p_janela integer)
returns table (reserva_id uuid, tipo public.tipo_mensagem_passeio, cliente_id uuid, saida_id uuid, vendedor_id uuid, saida_data date, saldo_centavos integer)
  language sql stable security invoker set search_path = '' as $$
  with base as (
    select r.id, r.cliente_id, r.saida_id, r.vendedor_id, s.data, a.dias_lembrete, a.dias_avaliacao,
      (r.valor_total_centavos - coalesce((select sum(case when p.tipo = 'estorno' then -p.valor_centavos else p.valor_centavos end) from public.pagamentos p where p.reserva_id = r.id), 0))::int as saldo
    from public.reservas r
    join public.saidas s on s.id = r.saida_id
    join public.agencias a on a.id = r.agencia_id
    where r.situacao = 'ativa' and s.situacao <> 'cancelada'
  ), candidatas as (
    select id, 'confirmacao'::public.tipo_mensagem_passeio as tipo, cliente_id, saida_id, vendedor_id, data, saldo from base where data >= p_hoje
    union all
    select id, 'lembrete', cliente_id, saida_id, vendedor_id, data, saldo from base where p_hoje between data - dias_lembrete and data
    union all
    select id, 'avaliacao', cliente_id, saida_id, vendedor_id, data, saldo from base where p_hoje between data + dias_avaliacao and data + p_janela
  )
  select c.id, c.tipo, c.cliente_id, c.saida_id, c.vendedor_id, c.data, c.saldo
  from candidatas c
  where not exists (select 1 from public.mensagens_passeio_envios e where e.reserva_id = c.id and e.tipo = c.tipo)
  order by c.data, c.tipo, c.id
  limit 500
$$;

-- One send = done WhatsApp activity + mark, atomically; never twice per reservation and type (CR010).
create function public.registrar_mensagem_passeio(p_reserva uuid, p_tipo public.tipo_mensagem_passeio, p_mensagem text) returns void
  language plpgsql security invoker set search_path = '' as $$
declare
  v_res public.reservas;
  v_atividade uuid;
  v_envio uuid;
  v_rotulo text := case p_tipo when 'confirmacao' then 'confirmação' when 'lembrete' then 'lembrete' else 'avaliação' end;
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

revoke all on function public.fila_mensagens_passeio(date, integer), public.registrar_mensagem_passeio(uuid, public.tipo_mensagem_passeio, text) from public, anon;
grant execute on function public.fila_mensagens_passeio(date, integer), public.registrar_mensagem_passeio(uuid, public.tipo_mensagem_passeio, text) to authenticated;
