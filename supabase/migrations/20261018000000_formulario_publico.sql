-- E5-5 (R65–R68): public lead form. A visitor (no account) sends name and WhatsApp; the lead lands in the funnel.
-- Visitors never touch tables: only the two functions below, granted to anon, which check everything themselves.

alter type public.tipo_aviso add value if not exists 'lead_formulario';

alter table public.negociacoes
  add column utm_fonte text check (char_length(utm_fonte) <= 100),
  add column utm_campanha text check (char_length(utm_campanha) <= 100);

create table public.formularios_publicos (
  agencia_id uuid primary key references public.agencias (id) on delete cascade,
  codigo text not null unique check (codigo ~ '^[A-Za-z0-9_-]{24}$'),
  ativo boolean not null default false,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  texto text not null default '' check (char_length(texto) <= 1000),
  atualizado_em timestamptz not null default now()
);
revoke all on public.formularios_publicos from anon, authenticated;
grant select on public.formularios_publicos to authenticated;
alter table public.formularios_publicos enable row level security;
create policy formularios_publicos_select on public.formularios_publicos for select to authenticated using (private.e_membro(agencia_id));

-- Submissions log for the rate limits (R68). Only a hash of the visitor's address, never the address itself.
create table public.envios_formulario (
  id bigserial primary key,
  agencia_id uuid not null references public.agencias (id) on delete cascade,
  visitante text not null check (char_length(visitante) between 1 and 128),
  criado_em timestamptz not null default now()
);
create index envios_formulario_agencia_idx on public.envios_formulario (agencia_id, criado_em);
revoke all on public.envios_formulario from anon, authenticated;
alter table public.envios_formulario enable row level security; -- no policy: nobody reads it directly

-- The owner saves the form; the code is created once, random (144 bits) and url-safe.
create function public.salvar_formulario(p_ativo boolean, p_titulo text, p_texto text) returns text
  language plpgsql security definer set search_path = '' as $$
declare
  v_agencia uuid;
  v_codigo text;
begin
  select m.agencia_id into v_agencia from public.membros m where m.user_id = (select auth.uid()) and m.papel = 'dono';
  if v_agencia is null then raise exception 'Só o dono muda o formulário' using errcode = '42501'; end if;
  insert into public.formularios_publicos (agencia_id, codigo, ativo, titulo, texto)
  values (v_agencia, translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), coalesce(p_ativo, false), btrim(p_titulo), coalesce(btrim(p_texto), ''))
  on conflict (agencia_id) do update set ativo = excluded.ativo, titulo = excluded.titulo, texto = excluded.texto, atualizado_em = now()
  returning codigo into v_codigo;
  return v_codigo;
end;
$$;
revoke all on function public.salvar_formulario(boolean, text, text) from public, anon;
grant execute on function public.salvar_formulario(boolean, text, text) to authenticated;

-- What the public page shows: only the agency name and its texts, and only while the form is on.
create function public.formulario_publico(p_codigo text) returns table (agencia text, titulo text, texto text)
  language sql stable security definer set search_path = '' as $$
  select a.nome, f.titulo, f.texto from public.formularios_publicos f join public.agencias a on a.id = f.agencia_id
  where f.codigo = p_codigo and f.ativo
$$;
revoke all on function public.formulario_publico(text) from public;
grant execute on function public.formulario_publico(text) to anon, authenticated;

-- CR016: too many submissions. Nothing about an existing client is ever overwritten (R67).
create function public.enviar_formulario_publico(
  p_codigo text, p_visitante text, p_nome text, p_whatsapp text, p_destino text, p_pessoas integer, p_data date,
  p_mensagem text, p_aceita boolean, p_origem text, p_utm_fonte text, p_utm_campanha text
) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_form public.formularios_publicos;
  v_cliente uuid;
  v_nome_cliente text;
  v_existia boolean;
  v_neg uuid;
  v_titulo text;
  v_destino text := nullif(btrim(p_destino), '');
  v_origem public.origem_lead := case when p_origem in ('instagram', 'indicacao', 'anuncio', 'site', 'outro') then p_origem::public.origem_lead else 'site' end;
begin
  select * into v_form from public.formularios_publicos where codigo = p_codigo and ativo;
  if not found then raise exception 'Formulário indisponível' using errcode = 'P0002'; end if;

  if p_nome is null or char_length(btrim(p_nome)) not between 1 and 200
     or p_whatsapp is null or p_whatsapp !~ '^[0-9]{10,15}$'
     or char_length(v_destino) > 120 or char_length(p_mensagem) > 1000
     or (p_pessoas is not null and p_pessoas not between 1 and 500)
     or p_visitante is null or char_length(p_visitante) not between 1 and 128
     or char_length(p_utm_fonte) > 100 or char_length(p_utm_campanha) > 100 then
    raise exception 'Dados do formulário inválidos' using errcode = '22023';
  end if;

  -- R68: per visitor and per agency, in the last hour (old rows are dropped as we go).
  delete from public.envios_formulario where agencia_id = v_form.agencia_id and criado_em < now() - interval '1 day';
  if (select count(*) from public.envios_formulario e where e.agencia_id = v_form.agencia_id and e.visitante = p_visitante and e.criado_em > now() - interval '1 hour') >= 5
     or (select count(*) from public.envios_formulario e where e.agencia_id = v_form.agencia_id and e.criado_em > now() - interval '1 hour') >= 30 then
    raise exception 'Muitos envios. Tente de novo mais tarde.' using errcode = 'CR016';
  end if;
  insert into public.envios_formulario (agencia_id, visitante) values (v_form.agencia_id, p_visitante);

  select c.id, c.nome into v_cliente, v_nome_cliente from public.clientes c
  where c.agencia_id = v_form.agencia_id and c.whatsapp = p_whatsapp order by c.criado_em limit 1;
  v_existia := v_cliente is not null;
  if not v_existia then
    insert into public.clientes (agencia_id, nome, whatsapp, origem, destinos_interesse, qtd_pessoas, consentimento_whatsapp, consentimento_em)
    values (v_form.agencia_id, btrim(p_nome), p_whatsapp, v_origem, case when v_destino is null then '{}' else array[v_destino] end, p_pessoas,
            case when p_aceita then 'aceitou' else 'nao_informado' end::public.consentimento_whatsapp, case when p_aceita then now() end)
    returning id, nome into v_cliente, v_nome_cliente;
  end if;

  v_titulo := left('Formulário: ' || coalesce(v_destino, 'novo contato'), 200);
  insert into public.negociacoes (agencia_id, cliente_id, titulo, data_fechamento_esperada, utm_fonte, utm_campanha)
  values (v_form.agencia_id, v_cliente, v_titulo, p_data, nullif(btrim(p_utm_fonte), ''), nullif(btrim(p_utm_campanha), ''))
  returning id into v_neg;

  insert into public.anotacoes (agencia_id, cliente_id, texto)
  values (v_form.agencia_id, v_cliente, left(concat_ws(E'\n',
    'Contato pelo formulário (origem: ' || v_origem::text || ').',
    case when v_existia then 'Nome informado: ' || btrim(p_nome) || '. Cliente já cadastrado: nada foi alterado na ficha.' end,
    case when v_destino is not null then 'Destino: ' || v_destino || '.' end,
    case when p_pessoas is not null then 'Pessoas: ' || p_pessoas || '.' end,
    case when p_data is not null then 'Data prevista: ' || to_char(p_data, 'DD/MM/YYYY') || '.' end,
    'Aceita receber mensagens: ' || case when p_aceita then 'sim' else 'não' end || '.',
    case when nullif(btrim(p_mensagem), '') is not null then 'Mensagem: ' || btrim(p_mensagem) end
  ), 4000));

  insert into public.avisos (agencia_id, tipo, negociacao_id, titulo, cliente_nome, valor_centavos)
  values (v_form.agencia_id, 'lead_formulario', v_neg, v_titulo, v_nome_cliente, 0);
end;
$$;
revoke all on function public.enviar_formulario_publico(text, text, text, text, text, integer, date, text, boolean, text, text, text) from public;
grant execute on function public.enviar_formulario_publico(text, text, text, text, text, integer, date, text, boolean, text, text, text) to anon, authenticated;
