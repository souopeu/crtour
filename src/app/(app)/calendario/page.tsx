import Link from 'next/link'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { getMembro } from '@/lib/auth/agencia'
import {
  ITENS_POR_DIA, TIPOS, gradeDoMes, hrefAlternar, hrefItem, hrefMes, lerMes, lerOcultos, mesVizinho, porDia, rotuloMes, textoVagas,
  type ItemCalendario, type TipoItem,
} from '@/lib/calendario/calendario'
import { listarCalendario } from '@/lib/calendario/dados'
import { formatarDataBr, hojeNoBrasil } from '@/lib/formato'
import { formatarReais } from '@/lib/passeios/dinheiro'

export const metadata = { title: 'Calendário' }

const DIAS_SEMANA = [['Seg', 'segunda'], ['Ter', 'terça'], ['Qua', 'quarta'], ['Qui', 'quinta'], ['Sex', 'sexta'], ['Sáb', 'sábado'], ['Dom', 'domingo']]
// Coloured left edge per type; the text always says what the item is (colour is never the only cue).
const COR: Record<TipoItem, string> = {
  saida: 'border-primaria bg-primaria-suave',
  saldo: 'border-alerta bg-alerta-suave',
  aniversario: 'border-receita bg-receita-suave',
  custo: 'border-despesa bg-despesa-suave',
}
const link = 'text-sm text-primaria underline-offset-2 hover:underline'

function textoItem(i: ItemCalendario): string {
  const reais = i.valor_centavos === null ? '' : formatarReais(i.valor_centavos)
  const passeio = i.detalhe ? ` · ${i.detalhe}` : ''
  switch (i.tipo) {
    case 'saida': return `Saída: ${i.titulo}, ${textoVagas(i.detalhe)}, ${i.situacao}`
    case 'saldo': return `Saldo: ${i.titulo}, ${reais}${passeio}`
    case 'aniversario': return `Aniversário: ${i.titulo}`
    case 'custo': return `Custo: ${i.titulo}, ${reais}${passeio}`
  }
}

function Item({ i }: { i: ItemCalendario }) {
  return (
    <Link
      href={hrefItem(i)}
      className={`block min-h-11 rounded-md border-l-4 px-2 py-1 text-xs leading-snug break-words text-tinta sm:min-h-0 ${COR[i.tipo]} ${i.situacao === 'cancelada' ? 'line-through' : ''}`}
    >
      {textoItem(i)}
    </Link>
  )
}

function ItensDoDia({ itens }: { itens: ItemCalendario[] }) {
  const resto = itens.slice(ITENS_POR_DIA)
  return (
    <div className="flex flex-col gap-1">
      {itens.slice(0, ITENS_POR_DIA).map((i) => <Item key={`${i.tipo}-${i.id}`} i={i} />)}
      {resto.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-primaria">+{resto.length}</summary>
          <div className="mt-1 flex flex-col gap-1">{resto.map((i) => <Item key={`${i.tipo}-${i.id}`} i={i} />)}</div>
        </details>
      )}
    </div>
  )
}

async function Conteudo({ searchParams }: Pick<PageProps<'/calendario'>, 'searchParams'>) {
  const p = await searchParams
  const hoje = hojeNoBrasil()
  const mes = lerMes(p.mes, hoje)
  const ocultos = lerOcultos(p.sem)
  const grade = gradeDoMes(mes)
  const [itens, membro] = await Promise.all([listarCalendario(grade.inicio, grade.fim), getMembro()])
  const tipos = TIPOS.filter((t) => t.tipo !== 'custo' || membro?.papel === 'dono')
  const rotulo = rotuloMes(mes)
  const dias = porDia((itens ?? []).filter((i) => !ocultos.has(i.tipo)))
  const diasDoMes = grade.semanas.flat().filter((d) => d.startsWith(mes) && dias.has(d))

  return (
    <>
      <nav aria-label="Meses" className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold first-letter:uppercase">{rotulo}</h2>
        <Link href={hrefMes(mesVizinho(mes, -1), ocultos)} className={link}>Mês anterior</Link>
        <Link href={hrefMes(hoje.slice(0, 7), ocultos)} className={link}>Hoje</Link>
        <Link href={hrefMes(mesVizinho(mes, 1), ocultos)} className={link}>Próximo mês</Link>
      </nav>

      <div aria-label="Mostrar no calendário" role="group" className="flex flex-wrap gap-2">
        {tipos.map((t) => {
          const visivel = !ocultos.has(t.tipo)
          return (
            <Link
              key={t.tipo}
              href={hrefAlternar(mes, ocultos, t.tipo)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border-l-4 px-4 text-sm ${COR[t.tipo]} ${visivel ? '' : 'opacity-60 line-through'}`}
            >
              {t.rotulo}<span className="sr-only">{visivel ? ' (mostrando)' : ' (oculto)'}</span>
            </Link>
          )
        })}
      </div>

      {itens === null && <p role="alert" className="text-sm">Não foi possível carregar o calendário. Tente de novo em instantes.</p>}

      <table aria-label={`Calendário de ${rotulo}`} className="hidden w-full table-fixed border-collapse sm:table">
        <thead>
          <tr>{DIAS_SEMANA.map(([curto, longo]) => <th key={curto} scope="col" className="py-1 text-xs font-medium text-tinta-suave"><abbr title={longo}>{curto}</abbr></th>)}</tr>
        </thead>
        <tbody>
          {grade.semanas.map((semana) => (
            <tr key={semana[0]}>
              {semana.map((d) => {
                const doMes = d.startsWith(mes)
                return (
                  <td key={d} className={`h-28 border border-linha p-1 align-top ${doMes ? 'bg-superficie' : 'bg-superficie-suave'}`}>
                    <div className={`mb-1 text-xs ${d === hoje ? 'inline-flex size-6 items-center justify-center rounded-full bg-marca font-semibold text-white' : doMes ? 'font-medium' : 'text-tinta-suave'}`}>
                      {Number(d.slice(8))}{d === hoje && <span className="sr-only"> (hoje)</span>}
                    </div>
                    <ItensDoDia itens={dias.get(d) ?? []} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ol aria-label="Agenda do mês" className="flex flex-col gap-4 sm:hidden">
        {diasDoMes.map((d) => (
          <li key={d} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{formatarDataBr(d)}{d === hoje && ' (hoje)'}</h3>
            <div className="flex flex-col gap-1">{(dias.get(d) ?? []).map((i) => <Item key={`${i.tipo}-${i.id}`} i={i} />)}</div>
          </li>
        ))}
        {diasDoMes.length === 0 && itens !== null && <li className="text-sm text-tinta-suave">Nada neste mês.</li>}
      </ol>
    </>
  )
}

export default function CalendarioPage({ searchParams }: PageProps<'/calendario'>) {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[1.75rem] font-medium tracking-tight">Calendário</h1>
        <p className="text-sm text-tinta-suave">Saídas, saldos a vencer e aniversários do mês. Clique num item para abrir.</p>
      </div>
      <Suspense fallback={<Carregando altura="h-96" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
