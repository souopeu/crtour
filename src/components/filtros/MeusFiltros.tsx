'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { excluirFiltro, renomearFiltro, salvarFiltro } from '@/app/(app)/filtros/actions'
import { Mensagem } from '@/components/auth/Mensagem'
import { botaoBarra, campoBarra, chip } from '@/components/tela/estilos'
import { hrefFiltro, type FiltroSalvo, type TelaFiltro } from '@/lib/filtros/filtrosSalvos'
import type { EstadoForm } from '@/lib/forms'

function Renomear({ f, tela }: { f: FiltroSalvo; tela: TelaFiltro }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(renomearFiltro.bind(null, f.id, tela), {})
  const id = `renomear-${f.id}`
  return (
    <li className="flex flex-col gap-1">
      <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-wrap items-end gap-2">
        <label htmlFor={id} className="sr-only">Novo nome para {f.nome}</label>
        <input id={id} name="nome" defaultValue={f.nome} maxLength={40} required className={`${campoBarra} w-48`} />
        <button type="submit" aria-label={`Renomear ${f.nome}`} className="min-h-10 rounded-lg border border-controle px-3 text-sm">Renomear</button>
        <button type="submit" formAction={excluirFiltro.bind(null, f.id, tela)} aria-label={`Excluir ${f.nome}`} className="min-h-10 rounded-lg border border-despesa px-3 text-sm text-despesa">Excluir</button>
      </form>
      {estado.campos?.nome && <p className="text-xs text-despesa">{estado.campos.nome[0]}</p>}
      <Mensagem estado={{ erro: estado.erro }} />
    </li>
  )
}

// R82: the person's own saved filters for this screen, plus saving the current one.
export function MeusFiltros({ tela, atual, filtros }: { tela: TelaFiltro; atual: string; filtros: FiltroSalvo[] }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(salvarFiltro.bind(null, tela, atual), {})
  const idNome = `filtro-nome-${tela}`
  return (
    <section aria-label="Meus filtros" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        {filtros.length > 0 && (
          <ul aria-label="Filtros salvos" className="flex flex-wrap gap-2">
            {filtros.map((f) => <li key={f.id}><Link href={hrefFiltro(tela, f.parametros)} className={chip}>{f.nome}</Link></li>)}
          </ul>
        )}
        <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={idNome} className="text-xs font-medium text-tinta-suave">Nome do filtro</label>
            <input id={idNome} name="nome" maxLength={40} defaultValue={estado.valores?.nome} placeholder="Ex.: VIP de Europa" className={`${campoBarra} w-48`}
              aria-invalid={Boolean(estado.campos?.nome)} aria-describedby={estado.campos?.nome ? `${idNome}-erro` : undefined} />
          </div>
          <button type="submit" className={botaoBarra}>Salvar filtro</button>
        </form>
      </div>
      {estado.campos?.nome && <p id={`${idNome}-erro`} className="text-xs text-despesa">{estado.campos.nome[0]}</p>}
      <Mensagem estado={estado} />
      {filtros.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-primaria">Editar meus filtros</summary>
          <ul className="mt-2 flex flex-col gap-2">{filtros.map((f) => <Renomear key={f.id} f={f} tela={tela} />)}</ul>
        </details>
      )}
    </section>
  )
}
