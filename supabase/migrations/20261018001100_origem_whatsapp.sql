-- E7-3 (R80–R83): where each client came from, filled only by what arrives — nobody types it.
--   Meta: a "click to WhatsApp" ad sends the ad's data with the first message (the provider hands it as p_referencia).
--   Google: the ad points to /w/[código]; that page stores the click and opens WhatsApp with a short code in the
--   message ("cód. K7Q2M"); when the message arrives, the code links the client to the click.
--   Public form: the deal already keeps utm/gclid/fbclid (E7-2); the view below reads it from there.

create type public.canal_origem as enum ('meta', 'google', 'outro');

-- R80: arrivals through WhatsApp. Only the database functions write here.
create table public.origens_contato (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null,
  cliente_id uuid not null,
  canal public.canal_origem not null,
  campanha text check (char_length(campanha) <= 100),
  anuncio_id text check (char_length(anuncio_id) <= 100),
  anuncio_titulo text check (char_length(anuncio_titulo) <= 300),
  anuncio_url text check (char_length(anuncio_url) <= 1000),
  clique_id text check (char_length(clique_id) <= 255),          -- Meta ctwa_clid or Google gclid
  criado_em timestamptz not null default now(),
  foreign key (cliente_id, agencia_id) references public.clientes (id, agencia_id) on delete cascade
);
create index origens_contato_cliente_idx on public.origens_contato (cliente_id, criado_em);
create index origens_contato_agencia_idx on public.origens_contato (agencia_id, criado_em);
revoke all on public.origens_contato from anon, authenticated;
grant select on public.origens_contato to authenticated;
alter table public.origens_contato enable row level security;
create policy origens_contato_select on public.origens_contato for select to authenticated using (private.e_membro(agencia_id));

-- R81: the agency's WhatsApp link for Google ads. The owner sets the number and the opening message.
create table public.links_whatsapp (
  agencia_id uuid primary key references public.agencias (id) on delete cascade,
  codigo text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_') check (codigo ~ '^[A-Za-z0-9_-]{24}$'),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  mensagem text not null default 'Olá! Quero saber dos passeios.' check (char_length(btrim(mensagem)) between 1 and 300),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
revoke all on public.links_whatsapp from anon, authenticated;
grant select on public.links_whatsapp to authenticated;
grant insert (agencia_id, whatsapp, mensagem, ativo) on public.links_whatsapp to authenticated;
grant update (whatsapp, mensagem, ativo, atualizado_em) on public.links_whatsapp to authenticated;
alter table public.links_whatsapp enable row level security;
create policy links_whatsapp_select on public.links_whatsapp for select to authenticated using (private.e_membro(agencia_id));
create policy links_whatsapp_insert on public.links_whatsapp for insert to authenticated with check (private.e_dono(agencia_id));
create policy links_whatsapp_update on public.links_whatsapp for update to authenticated using (private.e_dono(agencia_id)) with check (private.e_dono(agencia_id));

-- One row per click on a Google ad link. The visitor is a salted hash, never the address. Nobody reads it directly.
create table public.cliques_anuncio (
  id bigserial primary key,
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  codigo text not null check (codigo ~ '^[A-HJ-NP-Z2-9]{5}$'),   -- no 0/O/1/I, easy to read in a message
  visitante text not null check (char_length(visitante) between 1 and 128),
  gclid text check (char_length(gclid) <= 255),
  utm_fonte text check (char_length(utm_fonte) <= 100),
  utm_midia text check (char_length(utm_midia) <= 100),
  utm_campanha text check (char_length(utm_campanha) <= 100),
  utm_termo text check (char_length(utm_termo) <= 100),
  utm_conteudo text check (char_length(utm_conteudo) <= 100),
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  unique (agencia_id, codigo)
);
create index cliques_anuncio_visitante_idx on public.cliques_anuncio (agencia_id, criado_em);
revoke all on public.cliques_anuncio from anon, authenticated;
alter table public.cliques_anuncio enable row level security; -- no policy: only the functions below touch it

-- R81: the /w/ page stores the click and gets back the code, the number and the message. CR016 = too many clicks.
create function public.registrar_clique_anuncio(
  p_link text, p_visitante text, p_gclid text, p_utm_fonte text, p_utm_midia text, p_utm_campanha text, p_utm_termo text, p_utm_conteudo text
) returns table (codigo text, whatsapp text, mensagem text)
  language plpgsql security definer set search_path = '' as $$
declare
  v_link public.links_whatsapp;
  v_codigo text;
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 symbols: byte % 32 is unbiased
  v_bytes bytea;
begin
  select * into v_link from public.links_whatsapp l where l.codigo = p_link and l.ativo;
  if not found then raise exception 'Link indisponível' using errcode = 'P0002'; end if;
  if p_visitante is null or char_length(p_visitante) not between 1 and 128
     or char_length(p_gclid) > 255 or char_length(p_utm_fonte) > 100 or char_length(p_utm_midia) > 100
     or char_length(p_utm_campanha) > 100 or char_length(p_utm_termo) > 100 or char_length(p_utm_conteudo) > 100 then
    raise exception 'Dados do clique inválidos' using errcode = '22023';
  end if;

  -- Unused clicks older than 30 days are dropped as we go; per visitor and per agency limits in the last hour.
  delete from public.cliques_anuncio c where c.agencia_id = v_link.agencia_id and c.usado_em is null and c.criado_em < now() - interval '30 days';
  if (select count(*) from public.cliques_anuncio c where c.agencia_id = v_link.agencia_id and c.visitante = p_visitante and c.criado_em > now() - interval '1 hour') >= 10
     or (select count(*) from public.cliques_anuncio c where c.agencia_id = v_link.agencia_id and c.criado_em > now() - interval '1 hour') >= 500 then
    raise exception 'Muitos cliques. Tente de novo mais tarde.' using errcode = 'CR016';
  end if;

  for tentativa in 1..10 loop
    v_bytes := extensions.gen_random_bytes(5);
    v_codigo := '';
    for i in 0..4 loop v_codigo := v_codigo || substr(v_alfabeto, get_byte(v_bytes, i) % 32 + 1, 1); end loop;
    insert into public.cliques_anuncio (agencia_id, codigo, visitante, gclid, utm_fonte, utm_midia, utm_campanha, utm_termo, utm_conteudo)
    values (v_link.agencia_id, v_codigo, p_visitante, nullif(btrim(p_gclid), ''), nullif(btrim(p_utm_fonte), ''), nullif(btrim(p_utm_midia), ''),
            nullif(btrim(p_utm_campanha), ''), nullif(btrim(p_utm_termo), ''), nullif(btrim(p_utm_conteudo), ''))
    on conflict on constraint cliques_anuncio_agencia_id_codigo_key do nothing;
    if found then return query select v_codigo, v_link.whatsapp, v_link.mensagem; return; end if;
  end loop;
  raise exception 'Não foi possível gerar o código' using errcode = 'CR017';
end;
$$;
revoke all on function public.registrar_clique_anuncio(text, text, text, text, text, text, text, text) from public;
grant execute on function public.registrar_clique_anuncio(text, text, text, text, text, text, text, text) to anon, authenticated;

-- R82: what an incoming message says about its origin. Meta ad data wins; otherwise a Google click code in the text.
-- A code is used once and expires in 30 days. A client created by this message gets origin "anúncio".
create function private.registrar_origem_whatsapp(p_agencia uuid, p_cliente uuid, p_novo boolean, p_texto text, p_referencia jsonb, p_em timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_codigo text;
  v_clique public.cliques_anuncio;
  v_achou boolean := false;
begin
  if jsonb_typeof(p_referencia) = 'object' and p_referencia->>'tipo' = 'anuncio' then
    insert into public.origens_contato (agencia_id, cliente_id, canal, anuncio_id, anuncio_titulo, anuncio_url, clique_id, criado_em)
    values (p_agencia, p_cliente, 'meta', left(nullif(btrim(p_referencia->>'anuncio_id'), ''), 100), left(nullif(btrim(p_referencia->>'titulo'), ''), 300),
            left(nullif(btrim(p_referencia->>'url'), ''), 1000), left(nullif(btrim(p_referencia->>'clique_id'), ''), 255), p_em);
    v_achou := true;
  else
    v_codigo := upper((regexp_match(coalesce(p_texto, ''), 'c[oó]d\.?:?\s*([a-z0-9]{5})', 'i'))[1]);
    if v_codigo is not null then
      update public.cliques_anuncio c set usado_em = now()
      where c.agencia_id = p_agencia and c.codigo = v_codigo and c.usado_em is null and c.criado_em > now() - interval '30 days'
      returning * into v_clique;
      if found then
        insert into public.origens_contato (agencia_id, cliente_id, canal, campanha, clique_id, criado_em)
        values (p_agencia, p_cliente,
                case when v_clique.gclid is not null or lower(v_clique.utm_fonte) in ('google', 'adwords', 'google_ads') then 'google'
                     when lower(v_clique.utm_fonte) in ('meta', 'facebook', 'instagram', 'fb', 'ig') then 'meta' else 'outro' end::public.canal_origem,
                nullif(lower(btrim(v_clique.utm_campanha)), ''), v_clique.gclid, p_em);
        v_achou := true;
      end if;
    end if;
  end if;
  if v_achou and p_novo then update public.clientes set origem = 'anuncio' where id = p_cliente; end if;
end;
$$;
revoke all on function private.registrar_origem_whatsapp(uuid, uuid, boolean, text, jsonb, timestamptz) from public, anon, authenticated;

-- The incoming-message function takes the ad data in one optional argument, so the current callers keep working.
drop function public.whatsapp_receber(text, text, text, text, text, text, timestamptz);
create function public.whatsapp_receber(p_provedor text, p_conta text, p_id_externo text, p_de text, p_nome text, p_texto text, p_recebida_em timestamptz,
  p_referencia jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
  v_cliente uuid;
  v_atividade uuid;
  v_novo boolean := false;
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
  perform private.registrar_origem_whatsapp(v_agencia, v_cliente, v_novo, p_texto, p_referencia, coalesce(p_recebida_em, now()));
  insert into public.atividades (agencia_id, cliente_id, tipo, titulo, quando, status)
  values (v_agencia, v_cliente, 'whatsapp', left('WhatsApp recebido: ' || coalesce(regexp_replace(btrim(p_texto), '\s+', ' ', 'g'), '(sem texto)'), 200), coalesce(p_recebida_em, now()), 'feito')
  returning id into v_atividade;
  insert into public.mensagens_whatsapp (agencia_id, cliente_id, provedor, id_externo, direcao, texto, situacao, atividade_id, criada_em)
  values (v_agencia, v_cliente, p_provedor, p_id_externo, 'recebida', left(p_texto, 4096), 'recebida', v_atividade, coalesce(p_recebida_em, now()))
  on conflict (provedor, id_externo) do nothing;
end;
$$;
revoke all on function public.whatsapp_receber(text, text, text, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.whatsapp_receber(text, text, text, text, text, text, timestamptz, jsonb) to service_role;

-- R80: every known arrival of a client: WhatsApp (table above) and the public form (tags kept on the deal).
-- `chave` groups arrivals into campaigns: the Meta ad, else the campaign tag, else just the channel.
create view public.v_origens_cliente with (security_invoker = true) as
select o.agencia_id, o.cliente_id, o.canal, 'whatsapp'::text as via, o.campanha, o.anuncio_id, o.anuncio_titulo, o.anuncio_url, o.criado_em,
       coalesce('anuncio:' || o.anuncio_id, o.campanha, 'canal:' || o.canal::text) as chave
from public.origens_contato o
union all
select n.agencia_id, n.cliente_id, c.canal, 'formulario', nullif(lower(btrim(n.utm_campanha)), ''), null, null, null, n.criado_em,
       coalesce(nullif(lower(btrim(n.utm_campanha)), ''), 'canal:' || c.canal::text)
from public.negociacoes n
cross join lateral (select case
  when n.gclid is not null or lower(n.utm_fonte) in ('google', 'adwords', 'google_ads') then 'google'
  when n.fbclid is not null or lower(n.utm_fonte) in ('meta', 'facebook', 'instagram', 'fb', 'ig') then 'meta'
  else 'outro' end::public.canal_origem as canal) c
where n.utm_campanha is not null or n.utm_fonte is not null or n.gclid is not null or n.fbclid is not null;
revoke all on public.v_origens_cliente from anon, authenticated;
grant select on public.v_origens_cliente to authenticated;

-- R83: campaigns built from what arrives. For each key: clients whose arrival falls in the period (leads), those
-- with a won deal created from the arrival on (sales) and its value. A registered campaign only adds name and spend.
-- Clients created in the period with no known arrival come back as one row with a null key ("not identified").
drop function public.resultado_campanhas(date, date);
create function public.resultado_campanhas(p_de date, p_ate date)
returns table (chave text, canal text, titulo text, campanha_id uuid, nome text, inicio date, fim date,
               gasto_centavos bigint, leads bigint, vendas bigint, valor_vendido_centavos bigint)
  language sql stable security invoker set search_path = '' as $$
  with o as (
    select v.chave, v.cliente_id, min(v.criado_em) as em,
           (array_agg(v.canal::text order by v.criado_em))[1] as canal,
           (array_agg(v.anuncio_titulo order by v.criado_em) filter (where v.anuncio_titulo is not null))[1] as titulo
    from public.v_origens_cliente v
    where (v.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    group by v.chave, v.cliente_id
  ), s as (
    select o.chave, o.cliente_id, o.canal, o.titulo, count(n.id) as vendas, coalesce(sum(n.valor_centavos), 0) as valor
    from o
    left join public.negociacoes n on n.cliente_id = o.cliente_id and n.etapa in ('pago', 'viajou', 'pos_venda') and n.criado_em >= o.em - interval '1 day'
    group by o.chave, o.cliente_id, o.canal, o.titulo
  ), g as (
    select s.chave, min(s.canal) as canal, max(s.titulo) as titulo, count(*) as leads,
           count(*) filter (where s.vendas > 0) as vendas, sum(s.valor)::bigint as valor
    from s group by s.chave
  ), sem as (
    select count(*) as leads,
           count(*) filter (where exists (select 1 from public.negociacoes n where n.cliente_id = c.id and n.etapa in ('pago', 'viajou', 'pos_venda'))) as vendas,
           coalesce((select sum(n.valor_centavos) from public.negociacoes n
                     where n.etapa in ('pago', 'viajou', 'pos_venda') and n.cliente_id in (select c2.id from public.clientes c2
                       where (c2.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
                         and not exists (select 1 from public.v_origens_cliente v where v.cliente_id = c2.id))), 0)::bigint as valor
    from public.clientes c
    where (c.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
      and not exists (select 1 from public.v_origens_cliente v where v.cliente_id = c.id)
  )
  select * from (
    select coalesce(c.utm_campanha, g.chave), coalesce(g.canal, c.canal::text), g.titulo, c.id, c.nome, c.inicio, c.fim,
           coalesce(c.gasto_centavos, 0), coalesce(g.leads, 0), coalesce(g.vendas, 0), coalesce(g.valor, 0)
    from public.campanhas c
    full join g on g.chave = c.utm_campanha
    order by coalesce(g.leads, 0) desc, 1
  ) r
  union all
  select null, null, null, null, null, null, null, 0, sem.leads, sem.vendas, sem.valor from sem where sem.leads > 0
$$;
revoke all on function public.resultado_campanhas(date, date) from public, anon;
grant execute on function public.resultado_campanhas(date, date) to authenticated;
