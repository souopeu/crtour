import Link from 'next/link'
import type { ClienteDaLista, EtiquetaLinha } from '@/lib/clientes/dados'
import { hrefDaLista, resumoDaPagina, type Filtros } from '@/lib/clientes/filtros'
import { ROTULO_CONSENTIMENTO, ROTULO_ORIGEM, formatarWhatsapp } from '@/lib/clientes/rotulos'
import { ouTraco } from '@/lib/formato'
import { AbasDeVisao } from '@/components/tela/AbasDeVisao'
import { botaoBarra, campoBarra, rotuloBarra } from '@/components/tela/estilos'
import { EstadoVazio } from '@/components/tela/EstadoVazio'

type Props = { filtros: Filtros; clientes: ClienteDaLista[]; total: number; etiquetas: EtiquetaLinha[]; cidades: string[]; abaixoDaBarra?: React.ReactNode }

// Consent as a status block: colour plus the words, never colour alone.
const BLOCO_CONSENTIMENTO: Record<string, string> = {
  aceitou: 'bg-receita-suave text-receita',
  pediu_saida: 'bg-despesa-suave text-despesa',
  nao_informado: 'bg-superficie-suave text-tinta-suave',
}

function Tabela({ clientes, total }: { clientes: ClienteDaLista[]; total: number }) {
  return (
    <div className="overflow-x-auto rounded-(--radius-cartao) border border-l-4 border-linha border-l-primaria bg-superficie">
      <table aria-label="Clientes" className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="h-(--linha-tabela) border-b border-linha text-xs text-tinta-suave">
            <th className="px-3 font-medium">Cliente</th>
            <th className="px-2 font-medium">WhatsApp</th>
            <th className="px-2 font-medium">Cidade</th>
            <th className="px-2 font-medium">Origem</th>
            <th className="px-3 font-medium">Mensagens</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id} className="h-(--linha-tabela) border-b border-linha hover:bg-superficie-suave">
              <td className="px-3 py-1"><Link href={`/clientes/${c.id}`} className="font-medium text-primaria underline">{c.nome}</Link></td>
              <td className="px-2 py-1 tabular-nums">{ouTraco(c.whatsapp ? formatarWhatsapp(c.whatsapp) : null)}</td>
              <td className="px-2 py-1">{ouTraco(c.cidade)}</td>
              <td className="px-2 py-1">{ouTraco(c.origem ? ROTULO_ORIGEM[c.origem] : null)}</td>
              <td className="px-3 py-1">
                <span className={`inline-block rounded-md px-2 py-1 text-xs font-semibold ${BLOCO_CONSENTIMENTO[c.consentimento_whatsapp] ?? ''}`}>
                  {ROTULO_CONSENTIMENTO[c.consentimento_whatsapp]}
                </span>
              </td>
            </tr>
          ))}
          <tr className="h-(--linha-tabela) border-b border-linha">
            <td colSpan={5} className="px-3"><Link href="/clientes/novo" className="text-sm text-tinta-suave hover:text-primaria hover:underline">+ Adicionar cliente</Link></td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="h-(--linha-tabela) bg-superficie-suave text-sm font-semibold">
            <td className="px-3">Total</td>
            <td colSpan={4} className="px-2 font-normal text-tinta-suave">{total} {total === 1 ? 'cliente' : 'clientes'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Cartoes({ clientes }: { clientes: ClienteDaLista[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {clientes.map((c) => (
        <li key={c.id}>
          <Link href={`/clientes/${c.id}`} className="flex min-h-14 flex-col gap-1 rounded-(--radius-cartao) border border-linha bg-superficie p-3 hover:shadow-md">
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
  )
}

export function ListaClientes({ filtros, clientes, total, etiquetas, cidades, abaixoDaBarra }: Props) {
  const resumo = resumoDaPagina(total, filtros.pagina)
  const temFiltro = Boolean(filtros.q || filtros.etiqueta || filtros.origem || filtros.cidade)

  return (
    <>
      <AbasDeVisao rotulo="Visões dos clientes" abas={[
        { rotulo: 'Tabela', href: hrefDaLista({ ...filtros, visao: 'tabela' }), ativa: filtros.visao === 'tabela' },
        { rotulo: 'Cartões', href: hrefDaLista({ ...filtros, visao: 'cartoes' }), ativa: filtros.visao === 'cartoes' },
      ]} />

      {/* R60: the search and filters live in the URL, so they survive switching views. */}
      <form key={hrefDaLista(filtros)} method="get" action="/" role="search" className="flex flex-wrap items-end gap-3">
        {filtros.visao === 'cartoes' && <input type="hidden" name="visao" value="cartoes" />}
        <div className="flex flex-col gap-1">
          <label htmlFor={`q-${filtros.visao}`} className={rotuloBarra}>Buscar por nome, e-mail ou telefone</label>
          <input id={`q-${filtros.visao}`} name="q" type="search" defaultValue={filtros.q} maxLength={100} className={`${campoBarra} w-64`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`etiqueta-${filtros.visao}`} className={rotuloBarra}>Etiqueta</label>
          <select id={`etiqueta-${filtros.visao}`} name="etiqueta" defaultValue={filtros.etiqueta ?? ''} className={campoBarra}>
            <option value="">Todas</option>
            {etiquetas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`origem-${filtros.visao}`} className={rotuloBarra}>Origem</label>
          <select id={`origem-${filtros.visao}`} name="origem" defaultValue={filtros.origem ?? ''} className={campoBarra}>
            <option value="">Todas</option>
            {Object.entries(ROTULO_ORIGEM).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`cidade-${filtros.visao}`} className={rotuloBarra}>Cidade</label>
          <select id={`cidade-${filtros.visao}`} name="cidade" defaultValue={filtros.cidade} className={campoBarra}>
            <option value="">Todas</option>
            {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button type="submit" className={botaoBarra}>Filtrar</button>
        {temFiltro && <Link href={hrefDaLista({ q: '', etiqueta: null, origem: null, cidade: '', pagina: 1, visao: filtros.visao })} className="inline-flex min-h-10 items-center text-sm text-primaria underline">Limpar filtros</Link>}
      </form>
      {abaixoDaBarra}

      {(total > 0 || temFiltro) && (
        <p aria-live="polite" className="text-sm text-tinta-suave">
          {total === 0 ? 'Nenhum cliente encontrado.' : `Mostrando ${resumo.de}–${resumo.ate} de ${total}`}
        </p>
      )}

      {clientes.length === 0 && !temFiltro && filtros.pagina === 1 ? (
        <EstadoVazio acoes={[{ href: '/clientes/novo', rotulo: 'Cadastrar o primeiro cliente' }, { href: '/importar', rotulo: 'Importar uma planilha' }]}>
          Você ainda não tem clientes. Cadastre um por um ou traga a planilha que você já usa.
        </EstadoVazio>
      ) : clientes.length === 0 ? (
        <p className="rounded-(--radius-cartao) border border-linha bg-superficie p-4">
          {temFiltro ? 'Nenhum cliente combina com esses filtros. Tente outra busca ou limpe os filtros.' : 'Não há clientes nesta página.'}
        </p>
      ) : filtros.visao === 'tabela' ? <Tabela clientes={clientes} total={total} /> : <Cartoes clientes={clientes} />}

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
