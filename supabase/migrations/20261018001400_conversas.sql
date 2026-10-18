-- Spec 19, R100–R101: the WhatsApp inbox (Fatia 2a, database only; no screen yet).
-- A conversation is one per client and channel: who handles it (null = "Novos"), open or archived, last message,
-- last received (for the 24 h window) and unread count. Its timeline events record who did what.
-- Only the server and the functions below write; members read what they may see:
-- the owner sees every conversation; a seller sees new ones and her own (R102). Messages follow the same rule.

create type public.canal_conversa as enum ('whatsapp'); -- Instagram comes later (item 10): add a value, nothing else changes
create type public.situacao_conversa as enum ('aberta', 'arquivada');
create type public.tipo_evento_conversa as enum ('assumiu', 'transferiu', 'arquivou', 'reabriu', 'etiqueta_adicionada', 'etiqueta_removida', 'chegou_por_anuncio');
create type public.ator_evento_conversa as enum ('pessoa', 'sistema'); -- 'ia' only when there is an AI agent (item 5)

create table public.conversas (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  cliente_id uuid not null,
  canal public.canal_conversa not null default 'whatsapp',
  responsavel_id uuid,
  situacao public.situacao_conversa not null default 'aberta',
  ultima_mensagem_em timestamptz not null default now(),
  ultima_recebida_em timestamptz,
  ultima_previa text check (char_length(ultima_previa) <= 120),
  nao_lidas integer not null default 0 check (nao_lidas >= 0),
  criada_em timestamptz not null default now(),
  unique (id, agencia_id),
  unique (cliente_id, canal),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id) on delete cascade,
  foreign key (responsavel_id, agencia_id) references public.membros (user_id, agencia_id) on delete set null (responsavel_id)
);
create index conversas_lista_idx on public.conversas (agencia_id, situacao, ultima_mensagem_em desc);
create index conversas_responsavel_idx on public.conversas (responsavel_id);

create table public.eventos_conversa (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  conversa_id uuid not null,
  tipo public.tipo_evento_conversa not null,
  ator public.ator_evento_conversa not null,
  autor_id uuid references auth.users (id) on delete set null,
  para_id uuid references auth.users (id) on delete set null, -- who received a handed-over conversation
  detalhe text check (char_length(detalhe) <= 300),           -- tag name or ad title
  criado_em timestamptz not null default now(),
  foreign key (conversa_id, agencia_id) references public.conversas (id, agencia_id) on delete cascade
);
create index eventos_conversa_idx on public.eventos_conversa (conversa_id, criado_em);

-- Who may see a conversation (and its messages and events).
create function private.ve_conversa(p_agencia uuid, p_responsavel uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select private.e_dono(p_agencia) or (private.e_membro(p_agencia) and (p_responsavel is null or p_responsavel = (select auth.uid())))
$$;
revoke all on function private.ve_conversa(uuid, uuid) from public, anon;
grant execute on function private.ve_conversa(uuid, uuid) to authenticated;

revoke all on public.conversas, public.eventos_conversa from anon, authenticated;
grant select on public.conversas, public.eventos_conversa to authenticated;
alter table public.conversas enable row level security;
alter table public.eventos_conversa enable row level security;
create policy conversas_select on public.conversas for select to authenticated using (private.ve_conversa(agencia_id, responsavel_id));
create policy eventos_conversa_select on public.eventos_conversa for select to authenticated
  using (exists (select 1 from public.conversas c where c.id = conversa_id and private.ve_conversa(c.agencia_id, c.responsavel_id)));

-- Messages: same visibility as their conversation (was: any member of the agency).
drop policy mensagens_whatsapp_select on public.mensagens_whatsapp;
create policy mensagens_whatsapp_select on public.mensagens_whatsapp for select to authenticated
  using (exists (select 1 from public.conversas c where c.cliente_id = mensagens_whatsapp.cliente_id and c.canal = 'whatsapp'
                 and private.ve_conversa(c.agencia_id, c.responsavel_id)));

-- One line, at most 120 characters, for the list.
create function private.previa_conversa(p_texto text, p_modelo text) returns text
  language sql immutable set search_path = '' as $$
  select left(coalesce(nullif(regexp_replace(btrim(p_texto), '\s+', ' ', 'g'), ''), 'Modelo: ' || p_modelo, '(sem texto)'), 120)
$$;

-- Called by the receive and send functions. A received message counts as unread and reopens an archived conversation.
create function private.atualizar_conversa(p_agencia uuid, p_cliente uuid, p_previa text, p_em timestamptz, p_recebida boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_conversa public.conversas;
  v_antes public.situacao_conversa;
begin
  select situacao into v_antes from public.conversas where cliente_id = p_cliente and canal = 'whatsapp' for update;
  insert into public.conversas as c (agencia_id, cliente_id, canal, ultima_mensagem_em, ultima_recebida_em, ultima_previa, nao_lidas)
  values (p_agencia, p_cliente, 'whatsapp', p_em, case when p_recebida then p_em end, p_previa, case when p_recebida then 1 else 0 end)
  on conflict (cliente_id, canal) do update set
    ultima_mensagem_em = greatest(c.ultima_mensagem_em, excluded.ultima_mensagem_em),
    ultima_previa = case when excluded.ultima_mensagem_em >= c.ultima_mensagem_em then excluded.ultima_previa else c.ultima_previa end,
    ultima_recebida_em = case when p_recebida then greatest(c.ultima_recebida_em, excluded.ultima_recebida_em) else c.ultima_recebida_em end,
    nao_lidas = c.nao_lidas + case when p_recebida then 1 else 0 end,
    situacao = case when p_recebida then 'aberta' else c.situacao end
  returning * into v_conversa;
  if p_recebida and v_antes = 'arquivada' then
    insert into public.eventos_conversa (agencia_id, conversa_id, tipo, ator) values (p_agencia, v_conversa.id, 'reabriu', 'sistema');
  end if;
  return v_conversa.id;
end;
$$;
revoke all on function private.atualizar_conversa(uuid, uuid, text, timestamptz, boolean) from public, anon, authenticated;

-- Incoming message (same as 20261018001100, plus the conversation). Idempotent: a repeated notice stops at the first line.
create or replace function public.whatsapp_receber(p_provedor text, p_conta text, p_id_externo text, p_de text, p_nome text, p_texto text, p_recebida_em timestamptz,
  p_referencia jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
  v_cliente uuid;
  v_atividade uuid;
  v_conversa uuid;
  v_novo boolean := false;
  v_em timestamptz := coalesce(p_recebida_em, now());
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
    v_novo := true;
  end if;
  perform private.registrar_origem_whatsapp(v_agencia, v_cliente, v_novo, p_texto, p_referencia, v_em);
  insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status)
  values (v_agencia, v_cliente, 'whatsapp', left('WhatsApp recebido: ' || coalesce(regexp_replace(btrim(p_texto), '\s+', ' ', 'g'), '(sem texto)'), 200), v_em, 'feito')
  returning id into v_atividade;
  insert into public.mensagens_whatsapp (agencia_id, cliente_id, provedor, id_externo, direcao, texto, situacao, atividade_id, criada_em)
  values (v_agencia, v_cliente, p_provedor, p_id_externo, 'recebida', left(p_texto, 4096), 'recebida', v_atividade, v_em)
  on conflict (provedor, id_externo) do nothing;

  v_conversa := private.atualizar_conversa(v_agencia, v_cliente, private.previa_conversa(p_texto, null), v_em, true);
  if jsonb_typeof(p_referencia) = 'object' and p_referencia->>'tipo' = 'anuncio' then
    insert into public.eventos_conversa (agencia_id, conversa_id, tipo, ator, detalhe)
    values (v_agencia, v_conversa, 'chegou_por_anuncio', 'sistema',
            left(coalesce(nullif(btrim(p_referencia->>'titulo'), ''), 'Anúncio ' || nullif(btrim(p_referencia->>'anuncio_id'), ''), 'Anúncio do Meta'), 300));
  end if;
end;
$$;

-- Outgoing message (same as 20261018000400, plus the conversation). Never to who asked to leave (CR009).
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
  if v_cli.consentimento_whatsapp = 'pediu_saida' then raise exception 'Cliente pediu para não receber mensagens' using errcode = 'CR009'; end if;
  insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status, criado_por)
  values (v_cli.agencia_id, p_cliente, 'whatsapp', left('WhatsApp enviado: ' || coalesce(regexp_replace(btrim(p_texto), '\s+', ' ', 'g'), 'modelo ' || p_modelo), 200), now(), 'feito', p_usuario)
  returning id into v_atividade;
  insert into public.mensagens_whatsapp (agencia_id, cliente_id, provedor, id_externo, direcao, texto, modelo, situacao, atividade_id, enviado_por)
  values (v_cli.agencia_id, p_cliente, p_provedor, p_id_externo, 'enviada', left(p_texto, 4096), p_modelo, 'enviada', v_atividade, p_usuario);
  perform private.atualizar_conversa(v_cli.agencia_id, p_cliente, private.previa_conversa(p_texto, p_modelo), now(), false);
end;
$$;

-- R104 actions (screen comes in 2b). Each one checks that the caller may see the conversation, then records an event.
create function private.conversa_visivel(p_conversa uuid) returns public.conversas
  language plpgsql stable security definer set search_path = '' as $$
declare
  v public.conversas;
begin
  select * into v from public.conversas where id = p_conversa;
  if v.id is null or not private.ve_conversa(v.agencia_id, v.responsavel_id) then
    raise exception 'Conversa não encontrada' using errcode = 'P0002';
  end if;
  return v;
end;
$$;
revoke all on function private.conversa_visivel(uuid) from public, anon, authenticated;

create function public.conversa_assumir(p_conversa uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v public.conversas := private.conversa_visivel(p_conversa);
begin
  update public.conversas set responsavel_id = (select auth.uid()) where id = v.id;
  insert into public.eventos_conversa (agencia_id, conversa_id, tipo, ator, autor_id) values (v.agencia_id, v.id, 'assumiu', 'pessoa', (select auth.uid()));
end;
$$;

create function public.conversa_transferir(p_conversa uuid, p_para uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v public.conversas := private.conversa_visivel(p_conversa);
begin
  if not exists (select 1 from public.membros m where m.user_id = p_para and m.agencia_id = v.agencia_id) then
    raise exception 'Escolha uma pessoa da agência' using errcode = '22023';
  end if;
  update public.conversas set responsavel_id = p_para where id = v.id;
  insert into public.eventos_conversa (agencia_id, conversa_id, tipo, ator, autor_id, para_id) values (v.agencia_id, v.id, 'transferiu', 'pessoa', (select auth.uid()), p_para);
end;
$$;

create function public.conversa_arquivar(p_conversa uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v public.conversas := private.conversa_visivel(p_conversa);
begin
  if v.situacao = 'arquivada' then return; end if;
  update public.conversas set situacao = 'arquivada' where id = v.id;
  insert into public.eventos_conversa (agencia_id, conversa_id, tipo, ator, autor_id) values (v.agencia_id, v.id, 'arquivou', 'pessoa', (select auth.uid()));
end;
$$;

create function public.conversa_marcar_lida(p_conversa uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v public.conversas := private.conversa_visivel(p_conversa);
begin
  update public.conversas set nao_lidas = 0 where id = v.id and nao_lidas > 0;
end;
$$;

revoke all on function public.conversa_assumir(uuid), public.conversa_transferir(uuid, uuid), public.conversa_arquivar(uuid), public.conversa_marcar_lida(uuid)
  from public, anon;
grant execute on function public.conversa_assumir(uuid), public.conversa_transferir(uuid, uuid), public.conversa_arquivar(uuid), public.conversa_marcar_lida(uuid)
  to authenticated;

-- Tags added to or removed from a client show up in the conversation, when there is one (R101).
create function private.evento_etiqueta_conversa() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  r record := coalesce(new, old);
begin
  insert into public.eventos_conversa (agencia_id, conversa_id, tipo, ator, autor_id, detalhe)
  select c.agencia_id, c.id, case when tg_op = 'INSERT' then 'etiqueta_adicionada' else 'etiqueta_removida' end::public.tipo_evento_conversa,
         case when (select auth.uid()) is null then 'sistema' else 'pessoa' end::public.ator_evento_conversa, (select auth.uid()), left(e.nome, 300)
  from public.conversas c join public.etiquetas e on e.id = r.etiqueta_id
  where c.cliente_id = r.cliente_id;
  return null;
end;
$$;
revoke all on function private.evento_etiqueta_conversa() from public, anon, authenticated;
create trigger cliente_etiquetas_evento_conversa after insert or delete on public.cliente_etiquetas
  for each row execute function private.evento_etiqueta_conversa();

-- Conversations for the messages that already exist (before this migration no one read them: count them as read).
insert into public.conversas (agencia_id, cliente_id, canal, ultima_mensagem_em, ultima_recebida_em, ultima_previa, nao_lidas, criada_em)
select distinct on (m.cliente_id) m.agencia_id, m.cliente_id, 'whatsapp', m.criada_em,
       (select max(r.criada_em) from public.mensagens_whatsapp r where r.cliente_id = m.cliente_id and r.direcao = 'recebida'),
       private.previa_conversa(m.texto, m.modelo), 0,
       (select min(p.criada_em) from public.mensagens_whatsapp p where p.cliente_id = m.cliente_id)
from public.mensagens_whatsapp m
order by m.cliente_id, m.criada_em desc
on conflict (cliente_id, canal) do nothing;
