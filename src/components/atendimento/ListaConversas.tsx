import Link from 'next/link'
import { ABAS, hrefAtendimento, iniciais, marcaDeEnvio, tempoRelativo, type FiltrosAtendimento } from '@/lib/atendimento/atendimento'
import { ATENDIMENTO } from '@/lib/atendimento/config'
import type { ItemConversa } from '@/lib/atendimento/dados'
import type { EtiquetaLinha } from '@/lib/clientes/dados'
import { rotuloDaEtapa } from '@/lib/negociacoes/negociacoes'
import { COR_ETAPA } from '@/components/negociacoes/coresEtapa'
import { campoBarra, rotuloBarra } from '@/components/tela/estilos'
import { EtiquetaCor } from './EtiquetaCor'

type Props = {
  filtros: FiltrosAtendimento; itens: ItemConversa[]; naoLidas: Map<string, number>; ehDono: boolean
  etiquetas: EtiquetaLinha[]; agora: Date
}

// R102, R103: tabs with counters, search and tag filter, then one line per conversation (Helena Fig. 1, Virtus Fig. 3).
export function ListaConversas({ filtros, itens, naoLidas, ehDono, etiquetas, agora }: Props) {
  const abas = ABAS.filter((a) => a.valor !== 'outros' || ehDono)
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Filas de atendimento" className="flex gap-1 overflow-x-auto border-b border-linha">
        {abas.map((a) => {
          const n = naoLidas.get(a.valor) ?? 0
          return (
            <Link key={a.valor} href={hrefAtendimento(filtros, { aba: a.valor, conversa: null })} aria-current={filtros.aba === a.valor ? 'page' : undefined}
              className="-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm text-tinta-suave hover:text-tinta aria-[current=page]:border-primaria aria-[current=page]:font-semibold aria-[current=page]:text-tinta">
              {a.rotulo}
              {n > 0 && <span className="rounded-full bg-despesa px-1.5 text-xs font-bold text-white">{n}<span className="sr-only"> com mensagens não lidas</span></span>}
            </Link>
          )
        })}
      </nav>

      <form method="get" action="/atendimento" role="search" aria-label="Buscar atendimento" className="flex flex-wrap items-end gap-2">
        {filtros.aba !== 'novos' && <input type="hidden" name="aba" value={filtros.aba} />}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="busca-atendimento" className={rotuloBarra}>Nome ou telefone</label>
          <input id="busca-atendimento" name="q" type="search" defaultValue={filtros.q} maxLength={ATENDIMENTO.MAX_BUSCA} className={`${campoBarra} w-full`} />
        </div>
        {etiquetas.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="etiqueta-atendimento" className={rotuloBarra}>Etiqueta</label>
            <select id="etiqueta-atendimento" name="etiqueta" defaultValue={filtros.etiqueta ?? ''} className={campoBarra}>
              <option value="">Todas</option>
              {etiquetas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        )}
        <button type="submit" className="min-h-10 rounded-lg border border-controle px-3 text-sm">Buscar</button>
      </form>

      {itens.length === 0 ? (
        <p className="rounded-(--radius-cartao) border border-linha bg-superficie p-4 text-sm text-tinta-suave">
          {filtros.q || filtros.etiqueta ? 'Nenhuma conversa com esse filtro.' : 'Nenhuma conversa nesta fila.'}
        </p>
      ) : (
        <ul aria-label="Conversas" className="flex flex-col overflow-hidden rounded-(--radius-cartao) border border-linha bg-superficie">
          {itens.map((c) => <Item key={c.id} c={c} filtros={filtros} agora={agora} />)}
        </ul>
      )}
    </div>
  )
}

function Item({ c, filtros, agora }: { c: ItemConversa; filtros: FiltrosAtendimento; agora: Date }) {
  const marca = c.ultima_direcao && c.ultima_situacao ? marcaDeEnvio(c.ultima_direcao, c.ultima_situacao) : null
  const extras = c.etiquetas.length - ATENDIMENTO.MAX_ETIQUETAS_ITEM
  const aberta = filtros.conversa === c.id
  return (
    <li className="border-t border-linha first:border-t-0">
      <Link href={hrefAtendimento(filtros, { conversa: c.id })} aria-current={aberta ? 'true' : undefined}
        className="flex gap-3 p-3 hover:bg-superficie-suave aria-[current=true]:bg-primaria-suave">
        <span aria-hidden="true" className="relative grid size-10 shrink-0 place-items-center rounded-full bg-superficie-suave text-sm font-semibold">
          {iniciais(c.cliente_nome)}
          <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-superficie bg-receita" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate ${c.nao_lidas > 0 ? 'font-bold' : 'font-semibold'}`}>{c.cliente_nome}</span>
            <span className="shrink-0 text-xs text-tinta-suave">{tempoRelativo(c.ultima_mensagem_em, agora)}</span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm text-tinta-suave">
              {marca && <span className="mr-1">{marca.simbolo}<span className="sr-only"> {marca.texto}:</span></span>}
              {c.ultima_previa ?? '—'}
            </span>
            {c.nao_lidas > 0 && (
              <span className="shrink-0 rounded-full bg-despesa px-1.5 text-xs font-bold text-white">{c.nao_lidas}<span className="sr-only"> não lidas</span></span>
            )}
          </span>
          {(c.etiquetas.length > 0 || c.etapa || c.responsavel_nome) && (
            <span className="flex flex-wrap items-center gap-1">
              {c.etapa && <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold text-etapa-texto ${COR_ETAPA[c.etapa].fundo}`}>{rotuloDaEtapa(c.etapa)}</span>}
              {c.etiquetas.slice(0, ATENDIMENTO.MAX_ETIQUETAS_ITEM).map((e) => <EtiquetaCor key={e.id} nome={e.nome} cor={e.cor} />)}
              {extras > 0 && <span className="text-xs text-tinta-suave">+{extras}</span>}
              {c.responsavel_nome && <span className="ml-auto text-xs text-tinta-suave">{c.responsavel_nome}</span>}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}
