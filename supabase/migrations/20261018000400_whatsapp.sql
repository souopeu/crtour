-- E5-8 (R73): WhatsApp structure, without an external account. Nothing here is visible on screen.
-- Only the server writes (service key, after validating the provider's signature); members read their agency's messages.
-- A "conversation" is the client's list of messages: no separate table until the inbox (E5-9) needs unread counters.

create type public.direcao_whatsapp as enum ('recebida', 'enviada');
create type public.situacao_whatsapp as enum ('recebida', 'enviada', 'entregue', 'lida', 'falhou');

-- Which agency owns a business number (the provider's account/number id) — the webhook arrives per number.
create table public.canais_whatsapp (
  agencia_id uuid primary key references public.agencias (id) on delete cascade,
  provedor text not null check (provedor ~ '^[a-z0-9_-]{1,40}$'),
  conta text not null check (char_length(conta) between 1 and 200),
  criado_em timestamptz not null default now(),
  unique (provedor, conta)
);
revoke all on public.canais_whatsapp from anon, authenticated;
grant select on public.canais_whatsapp to authenticated;
alter table public.canais_whatsapp enable row level security;
create policy canais_whatsapp_select on public.canais_whatsapp for select to authenticated using (private.e_membro(agencia_id));

create table public.mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  cliente_id uuid not null,
  provedor text not null check (provedor ~ '^[a-z0-9_-]{1,40}$'),
  id_externo text not null check (char_length(id_externo) between 1 and 200),
  direcao public.direcao_whatsapp not null,
  texto text check (char_length(texto) <= 4096),
  modelo text check (char_length(modelo) <= 100),   -- approved template name, for messages sent outside the 24 h window
  situacao public.situacao_whatsapp not null,
  atividade_id uuid references public.atividades (id) on delete set null,
  enviado_por uuid references auth.users (id) on delete set null,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  unique (provedor, id_externo),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id) on delete cascade
);
create index mensagens_whatsapp_cliente_idx on public.mensagens_whatsapp (cliente_id, criada_em desc);
create index mensagens_whatsapp_atividade_idx on public.mensagens_whatsapp (atividade_id);
revoke all on public.mensagens_whatsapp from anon, authenticated;
grant select on public.mensagens_whatsapp to authenticated;
alter table public.mensagens_whatsapp enable row level security;
create policy mensagens_whatsapp_select on public.mensagens_whatsapp for select to authenticated using (private.e_membro(agencia_id));

-- Incoming message. Idempotent (the provider retries). Unknown number = new client without consent (R74).
create function public.whatsapp_receber(p_provedor text, p_conta text, p_id_externo text, p_de text, p_nome text, p_texto text, p_recebida_em timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
  v_cliente uuid;
  v_atividade uuid;
begin
  if exists (select 1 from public.mensagens_whatsapp where provedor = p_provedor and id_externo = p_id_externo) then return; end if;
  select agencia_id into v_agencia from public.canais_whatsapp where provedor = p_provedor and conta = p_conta;
  if v_agencia is null then raise exception 'Número sem agência' using errcode = 'P0002'; end if;
  if p_de !~ '^[0-9]{10,15}$' then raise exception 'Número inválido' using errcode = '22023'; end if;

  select id into v_cliente from public.clientes where agencia_id = v_agencia and whatsapp = p_de order by criado_em limit 1;
  if v_cliente is null then
    insert into public.clientes (agencia_id, nome, whatsapp, origem)
    values (v_agencia, coalesce(nullif(left(btrim(p_nome), 200), ''), 'Contato do WhatsApp'), p_de, 'outro')
    returning id into v_cliente;
  end if;
  insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status)
  values (v_agencia, v_cliente, 'whatsapp', left('WhatsApp recebido: ' || coalesce(regexp_replace(btrim(p_texto), '\s+', ' ', 'g'), '(sem texto)'), 200), coalesce(p_recebida_em, now()), 'feito')
  returning id into v_atividade;
  insert into public.mensagens_whatsapp (agencia_id, cliente_id, provedor, id_externo, direcao, texto, situacao, atividade_id, criada_em)
  values (v_agencia, v_cliente, p_provedor, p_id_externo, 'recebida', left(p_texto, 4096), 'recebida', v_atividade, coalesce(p_recebida_em, now()))
  on conflict (provedor, id_externo) do nothing;
end;
$$;

-- Outgoing message, after the provider accepted it. On behalf of a member; never to who asked to leave (CR009).
create function public.whatsapp_registrar_envio(p_usuario uuid, p_cliente uuid, p_provedor text, p_id_externo text, p_texto text, p_modelo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cli public.clientes;
  v_atividade uuid;
begin
  select * into v_cli from public.clientes where id = p_cliente;
  if v_cli.id is null or not exists (select 1 from public.membros m where m.user_id = p_usuario and m.agencia_id = v_cli.agencia_id) then
    raise exception 'Cliente não encontrado' using errcode = '42501';
  end if;
  if v_cli.consentimento_whatsapp = 'pediu_saida' then raise exception 'Cliente pediu para não receber mensagens' using errcode = 'CR009'; end if;
  insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status, criado_por)
  values (v_cli.agencia_id, p_cliente, 'whatsapp', left('WhatsApp enviado: ' || coalesce(regexp_replace(btrim(p_texto), '\s+', ' ', 'g'), 'modelo ' || p_modelo), 200), now(), 'feito', p_usuario)
  returning id into v_atividade;
  insert into public.mensagens_whatsapp (agencia_id, cliente_id, provedor, id_externo, direcao, texto, modelo, situacao, atividade_id, enviado_por)
  values (v_cli.agencia_id, p_cliente, p_provedor, p_id_externo, 'enviada', left(p_texto, 4096), p_modelo, 'enviada', v_atividade, p_usuario);
end;
$$;

-- Delivery status from the provider: only moves forward (statuses can arrive out of order); "falhou" always wins.
create function public.whatsapp_status(p_provedor text, p_id_externo text, p_situacao public.situacao_whatsapp)
returns void language sql security definer set search_path = '' as $$
  update public.mensagens_whatsapp set situacao = p_situacao, atualizada_em = now()
  where provedor = p_provedor and id_externo = p_id_externo and direcao = 'enviada'
    and (p_situacao = 'falhou' or array_position(array['enviada', 'entregue', 'lida']::public.situacao_whatsapp[], p_situacao)
                                   > coalesce(array_position(array['enviada', 'entregue', 'lida']::public.situacao_whatsapp[], situacao), 0))
$$;

revoke all on function public.whatsapp_receber(text, text, text, text, text, text, timestamptz),
  public.whatsapp_registrar_envio(uuid, uuid, text, text, text, text),
  public.whatsapp_status(text, text, public.situacao_whatsapp) from public, anon, authenticated;
grant execute on function public.whatsapp_receber(text, text, text, text, text, text, timestamptz),
  public.whatsapp_registrar_envio(uuid, uuid, text, text, text, text),
  public.whatsapp_status(text, text, public.situacao_whatsapp) to service_role;
