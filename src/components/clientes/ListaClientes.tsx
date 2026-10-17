import Link from 'next/link'
import type { ClienteDaLista, EtiquetaLinha } from '@/lib/clientes/dados'
import { hrefDaLista, resumoDaPagina, type Filtros } from '@/lib/clientes/filtros'
import { ROTULO_CONSENTIMENTO, ROTULO_ORIGEM, formatarWhatsapp } from '@/lib/clientes/rotulos'

type Props = { filtros: Filtros; clientes: ClienteDaLista[]; total: number; etiquetas: EtiquetaLinha[]; cidades: string[] }

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

export function ListaClientes({ filtros, clientes, total, etiquetas, cidades }: Props) {
  const resumo = resumoDaPagina(total, filtros.pagina)
  const temFiltro = Boolean(filtros.q || filtros.etiqueta || filtros.origem || filtros.cidade)

  return (
    <>
      <form key={hrefDaLista(filtros)} method="get" action="/" role="search" className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-sm font-medium">Buscar por nome, e-mail ou telefone</label>
          <input id="q" name="q" type="search" defaultValue={filtros.q} maxLength={100} className={campo} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="etiqueta" className="text-sm font-medium">Etiqueta</label>
            <select id="etiqueta" name="etiqueta" defaultValue={filtros.etiqueta ?? ''} className={campo}>
              <option value="">Todas</option>
              {etiquetas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="origem" className="text-sm font-medium">Origem</label>
            <select id="origem" name="origem" defaultValue={filtros.origem ?? ''} className={campo}>
              <option value="">Todas</option>
              {Object.entries(ROTULO_ORIGEM).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cidade" className="text-sm font-medium">Cidade</label>
            <select id="cidade" name="cidade" defaultValue={filtros.cidade} className={campo}>
              <option value="">Todas</option>
              {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" className="min-h-12 rounded-full bg-destaque px-6 font-semibold text-destaque-texto">Filtrar</button>
          {temFiltro && <Link href="/" className="text-sm text-primaria underline">Limpar filtros</Link>}
        </div>
      </form>

      <p aria-live="polite" className="text-sm text-tinta-suave">
        {total === 0 ? 'Nenhum cliente encontrado.' : `Mostrando ${resumo.de}–${resumo.ate} de ${total}`}
      </p>

      {clientes.length === 0 ? (
        <p className="rounded-[--radius-cartao] border border-linha bg-superficie p-4">
          {temFiltro
            ? 'Nenhum cliente combina com esses filtros. Tente outra busca ou limpe os filtros.'
            : filtros.pagina > 1
              ? 'Não há clientes nesta página.'
              : 'Você ainda não tem clientes. Cadastre o primeiro em "Novo cliente".'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link href={`/clientes/${c.id}`} className="flex min-h-14 flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold">{c.nome}</span>
                <span className="flex flex-wrap gap-x-3 text-sm text-tinta-suave">
                  {c.whatsapp && <span>{formatarWhatsapp(c.whatsapp)}</span>}
                  {c.cidade && <span>{c.cidade}</span>}
                  {c.origem && <span>{ROTULO_ORIGEM[c.origem]}</span>}
                  <span className={c.consentimento_whatsapp === 'pediu_saida' ? 'text-despesa' : c.consentimento_whatsapp === 'aceitou' ? 'text-receita' : ''}>
                    {ROTULO_CONSENTIMENTO[c.consentimento_whatsapp]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {resumo.paginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between">
          {resumo.temAnterior
            ? <Link href={hrefDaLista({ ...filtros, pagina: filtros.pagina - 1 })} className="min-h-11 px-3 text-primaria underline">Anterior</Link>
            : <span />}
          <span className="text-sm text-tinta-suave">Página {filtros.pagina} de {resumo.paginas}</span>
          {resumo.temProxima
            ? <Link href={hrefDaLista({ ...filtros, pagina: filtros.pagina + 1 })} className="min-h-11 px-3 text-primaria underline">Próxima</Link>
            : <span />}
        </nav>
      )}
    </>
  )
}
