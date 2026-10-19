-- Spec 21 (W1): official WhatsApp in coexistence, read only. The agency keeps answering from the WhatsApp Business app;
-- crTOUR reads what arrives, what the agency sends from the phone (echoes) and the last 180 days of history.
-- For the Meta provider `conta` is the business phone number id, which is how each notice finds its agency.

create type public.modo_canal_whatsapp as enum ('leitura', 'envio');
create type public.situacao_canal_whatsapp as enum ('conectado', 'desconectado');

alter table public.canais_whatsapp
  add column waba_id text check (char_length(waba_id) between 1 and 100),
  add column numero text check (numero ~ '^[0-9]{10,15}$'),
  add column modo public.modo_canal_whatsapp not null default 'leitura',   -- R114: read only unless turned on later
  add column situacao public.situacao_canal_whatsapp not null default 'conectado',
  add column conectado_em timestamptz not null default now();

-- R112: a message the agency sent from the phone (no crTOUR person wrote it).
alter table public.mensagens_whatsapp add column pelo_celular boolean not null default false;

-- The client of a number in the agency; a new number becomes a client without consent (R74), named after WhatsApp.
create function private.cliente_do_numero(p_agencia uuid, p_numero text, p_nome text, out cliente_id uuid, out novo boolean)
  language plpgsql security definer set search_path = '' as $$
begin
  if p_numero !~ '^[0-9]{10,15}$' then raise exception 'Número inválido' using errcode = '22023'; end if;
  select c.id into cliente_id from public.clientes c where c.agencia_id = p_agencia and c.whatsapp = p_numero order by c.criado_em limit 1;
  novo := cliente_id is null;
  if novo then
    insert into public.clientes (agencia_id, nome, whatsapp, origem)
    values (p_agencia, coalesce(nullif(left(btrim(p_nome), 200), ''), 'Contato do WhatsApp'), p_numero, 'outro')
    returning id into cliente_id;
  end if;
end;
$$;
revoke all on function private.cliente_do_numero(uuid, text, text) from public, anon, authenticated;

create function private.agencia_do_canal(p_provedor text, p_conta text) returns uuid
  language plpgsql stable security definer set search_path = '' as $$
declare
  v uuid;
begin
  select agencia_id into v from public.canais_whatsapp where provedor = p_provedor and conta = p_conta and situacao = 'conectado';
  if v is null then raise exception 'Número sem agência' using errcode = 'P0002'; end if;
  return v;
end;
$$;
revoke all on function private.agencia_do_canal(text, text) from public, anon, authenticated;

-- R112: echo of a message sent from the WhatsApp Business app. Idempotent (the provider retries).
create function public.whatsapp_registrar_eco(p_provedor text, p_conta text, p_id_externo text, p_para text, p_texto text, p_enviada_em timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
  v_cliente uuid;
  v_atividade uuid;
  v_em timestamptz := coalesce(p_enviada_em, now());
begin
  if exists (select 1 from public.mensagens_whatsapp where provedor = p_provedor and id_externo = p_id_externo) then return; end if;
  v_agencia := private.agencia_do_canal(p_provedor, p_conta);
  select c.cliente_id into v_cliente from private.cliente_do_numero(v_agencia, p_para, null) c;
  insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status)
  values (v_agencia, v_cliente, 'whatsapp', left('WhatsApp enviado pelo celular: ' || coalesce(regexp_replace(btrim(p_texto), '\s+', ' ', 'g'), '(sem texto)'), 200), v_em, 'feito')
  returning id into v_atividade;
  insert into public.mensagens_whatsapp (agencia_id, cliente_id, provedor, id_externo, direcao, texto, situacao, atividade_id, criada_em, pelo_celular)
  values (v_agencia, v_cliente, p_provedor, p_id_externo, 'enviada', left(p_texto, 4096), 'enviada', v_atividade, v_em, true)
  on conflict (provedor, id_externo) do nothing;
  perform private.atualizar_conversa(v_agencia, v_cliente, private.previa_conversa(p_texto, null), v_em, false);
end;
$$;

-- R113: the last 180 days, once, right after connecting. Already read; one summary activity per client instead of one per message.
-- p_conversas: [{numero, nome, mensagens: [{id, do_cliente, texto, em}]}]. Names only fill a new client: an existing name never changes.
create function public.whatsapp_importar_historico(p_provedor text, p_conta text, p_conversas jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid := private.agencia_do_canal(p_provedor, p_conta);
  v_conversa jsonb;
  v_cliente uuid;
  v_novas integer;
begin
  if jsonb_typeof(p_conversas) <> 'array' then raise exception 'Histórico inválido' using errcode = '22023'; end if;
  for v_conversa in select * from jsonb_array_elements(p_conversas) loop
    select c.cliente_id into v_cliente from private.cliente_do_numero(v_agencia, v_conversa->>'numero', v_conversa->>'nome') c;

    with novas as (
      insert into public.mensagens_whatsapp (agencia_id, cliente_id, provedor, id_externo, direcao, texto, situacao, criada_em, pelo_celular)
      select v_agencia, v_cliente, p_provedor, left(m->>'id', 200),
             case when (m->>'do_cliente')::boolean then 'recebida' else 'enviada' end::public.direcao_whatsapp,
             left(m->>'texto', 4096),
             case when (m->>'do_cliente')::boolean then 'recebida' else 'enviada' end::public.situacao_whatsapp,
             (m->>'em')::timestamptz, not (m->>'do_cliente')::boolean
      from jsonb_array_elements(coalesce(v_conversa->'mensagens', '[]'::jsonb)) m
      where char_length(m->>'id') between 1 and 200
      on conflict (provedor, id_externo) do nothing
      returning 1
    )
    select count(*) into v_novas from novas;
    if v_novas = 0 then continue; end if;

    insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status)
    values (v_agencia, v_cliente, 'whatsapp', format('Histórico do WhatsApp importado: %s %s', v_novas, case when v_novas = 1 then 'mensagem' else 'mensagens' end), now(), 'feito');

    -- The conversation reflects the newest message; history never counts as unread.
    insert into public.conversas as c (agencia_id, cliente_id, canal, ultima_mensagem_em, ultima_recebida_em, ultima_previa, nao_lidas)
    select v_agencia, v_cliente, 'whatsapp', u.criada_em, r.em, private.previa_conversa(u.texto, u.modelo), 0
    from (select m.criada_em, m.texto, m.modelo from public.mensagens_whatsapp m where m.cliente_id = v_cliente order by m.criada_em desc limit 1) u,
         (select max(m.criada_em) as em from public.mensagens_whatsapp m where m.cliente_id = v_cliente and m.direcao = 'recebida') r
    on conflict (cliente_id, canal) do update set
      ultima_mensagem_em = excluded.ultima_mensagem_em, ultima_previa = excluded.ultima_previa,
      ultima_recebida_em = greatest(c.ultima_recebida_em, excluded.ultima_recebida_em);
  end loop;
end;
$$;

revoke all on function public.whatsapp_registrar_eco(text, text, text, text, text, timestamptz),
  public.whatsapp_importar_historico(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.whatsapp_registrar_eco(text, text, text, text, text, timestamptz),
  public.whatsapp_importar_historico(text, text, jsonb) to service_role;

-- R114: sending from crTOUR only when the channel allows it (same as 20261018001400, plus the mode check).
create or replace function public.whatsapp_registrar_envio(p_usuario uuid, p_cliente uuid, p_provedor text, p_id_externo text, p_texto text, p_modelo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cli public.clientes;
  v_atividade uuid;
begin
  select * into v_cli from public.clientes where id = p_cliente;
  if v_cli.id is null or not exists (select 1 from public.membros m where m.user_id = p_usuario and m.agencia_id = v_cli.agencia_id) then
    raise exception 'Cliente não encontrado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.canais_whatsapp w where w.agencia_id = v_cli.agencia_id and w.provedor = p_provedor and w.modo = 'envio' and w.situacao = 'conectado') then
    raise exception 'Envio pelo crTOUR desligado (modo só leitura)' using errcode = 'CR010';
  end if;
  if v_cli.consentimento_whatsapp = 'pediu_saida' then raise exception 'Cliente pediu para não receber mensagens' using errcode = 'CR009'; end if;
  insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status, criado_por)
  values (v_cli.agencia_id, p_cliente, 'whatsapp', left('WhatsApp enviado: ' || coalesce(regexp_replace(btrim(p_texto), '\s+', ' ', 'g'), 'modelo ' || p_modelo), 200), now(), 'feito', p_usuario)
  returning id into v_atividade;
  insert into public.mensagens_whatsapp (agencia_id, cliente_id, provedor, id_externo, direcao, texto, modelo, situacao, atividade_id, enviado_por)
  values (v_cli.agencia_id, p_cliente, p_provedor, p_id_externo, 'enviada', left(p_texto, 4096), p_modelo, 'enviada', v_atividade, p_usuario);
  perform private.atualizar_conversa(v_cli.agencia_id, p_cliente, private.previa_conversa(p_texto, p_modelo), now(), false);
end;
$$;
