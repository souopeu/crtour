import Link from 'next/link'
import { hrefAtendimento, linhaDoTempo, marcaDeEnvio, textoDoEvento, type FiltrosAtendimento } from '@/lib/atendimento/atendimento'
import type { Conversa } from '@/lib/atendimento/dados'
import { formatarDataHora } from '@/lib/formato'
import { rotuloDaEtapa } from '@/lib/negociacoes/negociacoes'
import type { MembroLinha } from '@/lib/negociacoes/dados'
import { COR_ETAPA } from '@/components/negociacoes/coresEtapa'
import { formatarWhatsapp } from '@/lib/clientes/rotulos'
import { AcoesConversa } from './AcoesConversa'
import { EtiquetaCor } from './EtiquetaCor'
import { MarcarLida } from './MarcarLida'

type Props = { conversa: Conversa; filtros: FiltrosAtendimento; membros: MembroLinha[]; meuId: string; agora: Date }

const hora = (iso: string) => formatarDataHora(iso).slice(-5)

// R104: the open conversation: header, actions, then messages and events by day (Virtus Fig. 4, Helena Fig. 7–8).
export function ConversaAberta({ conversa: c, filtros, membros, meuId, agora }: Props) {
  const nomes = new Map(membros.map((m) => [m.user_id, m.nome]))
  const responsavel = c.responsavelId ? nomes.get(c.responsavelId) ?? 'Pessoa removida' : null
  const ultimoEvento = c.eventos[c.eventos.length - 1]
  const recebeu = ultimoEvento?.tipo === 'transferiu' && ultimoEvento.para_id === meuId
  const dias = linhaDoTempo(
    c.mensagens.map((m) => ({ ...m, em: m.criada_em, tipo: 'mensagem' as const })),
    [
      ...c.eventos.map((e) => ({ id: e.id, em: e.criado_em, tipo: 'evento' as const, texto: textoDoEvento(e, nomes) })),
      ...c.etapas.map((e) => ({ id: e.id, em: e.em, tipo: 'evento' as const,
        texto: `Negociação ${e.negociacoes.titulo}: ${e.de ? rotuloDaEtapa(e.de) : ''} → ${rotuloDaEtapa(e.para)}` })),
    ],
    agora,
  )
  return (
    <section aria-labelledby="conversa-titulo" className="flex flex-col gap-3 rounded-(--radius-cartao) border border-linha bg-superficie p-3 sm:p-4">
      <MarcarLida id={c.id} naoLidas={c.naoLidas > 0} />
      <Link href={hrefAtendimento(filtros, { conversa: null })} className="inline-flex min-h-11 items-center text-sm text-primaria underline lg:hidden">← Voltar para a lista</Link>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="conversa-titulo" className="text-lg font-semibold">{c.clienteNome}</h2>
          <span className="text-sm text-tinta-suave">{c.clienteWhatsapp ? formatarWhatsapp(c.clienteWhatsapp) : '—'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.etapa && <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold text-etapa-texto ${COR_ETAPA[c.etapa].fundo}`}>{rotuloDaEtapa(c.etapa)}</span>}
          {c.etiquetas.map((e) => <EtiquetaCor key={e.id} nome={e.nome} cor={e.cor} />)}
          <span className="text-sm text-tinta-suave">
            {c.situacao === 'arquivada' ? 'Arquivada · ' : ''}{responsavel ? `Com ${responsavel}` : 'Ninguém assumiu ainda'}
          </span>
        </div>
        <p className="flex flex-wrap gap-x-4 text-sm">
          <Link href={`/clientes/${c.clienteId}`} className="text-primaria underline">Abrir a ficha</Link>
          <Link href={`/clientes/${c.clienteId}#origem-titulo`} className="text-primaria underline">De onde veio</Link>
        </p>
      </header>
      {recebeu && (
        <p role="status" className="rounded-lg bg-primaria-suave p-2 text-sm text-primaria">
          Atendimento passado para você por {nomes.get(ultimoEvento.autor_id ?? '') ?? 'Pessoa removida'}.
        </p>
      )}
      <AcoesConversa id={c.id} meuId={meuId} responsavelId={c.responsavelId} arquivada={c.situacao === 'arquivada'} membros={membros} />
      <ol aria-label="Mensagens e eventos" className="flex flex-col gap-3 border-t border-linha pt-3">
        {dias.length === 0 && <li className="text-sm text-tinta-suave">Nenhuma mensagem ainda.</li>}
        {dias.map((d) => (
          <li key={d.dia} className="flex flex-col gap-2">
            <p className="self-center rounded-full bg-superficie-suave px-3 py-0.5 text-xs text-tinta-suave">{d.rotulo}</p>
            <ol className="flex flex-col gap-2">
              {d.itens.map((i) => i.tipo === 'evento' ? (
                <li key={i.id} className="self-center text-center text-xs text-tinta-suave">{i.texto} · {hora(i.em)}</li>
              ) : (
                <Balao key={i.id} m={i} />
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <p className="border-t border-linha pt-3 text-sm text-tinta-suave">Responder pelo crTOUR chega na próxima etapa. Por enquanto, responda pelo WhatsApp.</p>
    </section>
  )
}

function Balao({ m }: { m: Conversa['mensagens'][number] & { em: string } }) {
  const enviada = m.direcao === 'enviada'
  const marca = marcaDeEnvio(m.direcao, m.situacao)
  return (
    <li className={`flex max-w-[85%] flex-col gap-1 rounded-2xl px-3 py-2 text-sm ${enviada ? 'self-end bg-primaria-suave' : 'self-start border border-linha bg-papel'}`}>
      <span className="sr-only">{enviada ? 'Enviada' : 'Recebida'}:</span>
      <span className="whitespace-pre-wrap break-words">{m.texto ?? (m.modelo ? `Modelo: ${m.modelo}` : '(sem texto)')}</span>
      <span className={`self-end text-xs ${m.situacao === 'falhou' ? 'text-despesa' : 'text-tinta-suave'}`}>
        {hora(m.em)}{marca && <> · {marca.simbolo}<span className="sr-only"> {marca.texto}</span></>}
      </span>
    </li>
  )
}
