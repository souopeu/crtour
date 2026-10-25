import Link from 'next/link'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { AbasDeVisao } from '@/components/tela/AbasDeVisao'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { caixaTabela, rodapeTabela, tabelaPadrao } from '@/components/tela/estilos'
import { FormVeiculo } from '@/components/veiculos/FormVeiculo'
import { listarVeiculos } from '@/lib/veiculos/dados'
import { rotuloCategoria } from '@/lib/veiculos/veiculos'
import { salvarVeiculo } from './actions'

export const metadata = { title: 'Veículos' }

async function Lista({ searchParams }: Pick<PageProps<'/veiculos'>, 'searchParams'>) {
  const arquivados = (await searchParams).arquivados === '1'
  const veiculos = await listarVeiculos(arquivados)
  return (
    <>
      <AbasDeVisao rotulo="Visões dos veículos" abas={[
        { rotulo: 'Ativos', href: '/veiculos', ativa: !arquivados },
        { rotulo: 'Arquivados', href: '/veiculos?arquivados=1', ativa: arquivados },
      ]} />
      {veiculos.length === 0 ? (
        arquivados
          ? <p className="rounded-(--radius-cartao) border border-linha bg-superficie p-4">Nenhum veículo arquivado.</p>
          : <EstadoVazio compacto acoes={[]}>Nenhum veículo ainda. Cadastre vans, ônibus e barcos para escolher na saída.</EstadoVazio>
      ) : (
        <div className={caixaTabela}>
          <table aria-label="Veículos" className={tabelaPadrao}>
            <thead><tr><th>Veículo</th><th>Tipo</th><th className="text-right">Lugares</th></tr></thead>
            <tbody>
              {veiculos.map((v) => (
                <tr key={v.id} className="hover:bg-superficie-suave">
                  <td><Link href={`/veiculos/${v.id}`} className="font-medium text-primaria underline">{v.nome}</Link></td>
                  <td><span className="rounded-md bg-superficie-suave px-2 py-0.5">{rotuloCategoria(v.categoria)}</span></td>
                  <td className="text-right tabular-nums">{v.lugares}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className={rodapeTabela}><td colSpan={3}>{veiculos.length} {veiculos.length === 1 ? 'veículo' : 'veículos'}</td></tr></tfoot>
          </table>
        </div>
      )}
    </>
  )
}

export default function VeiculosPage({ searchParams }: PageProps<'/veiculos'>) {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4">
      <CabecalhoPagina area="Operação" titulo="Veículos" descricao="Vans, ônibus, barcos e outros veículos usados nas saídas." />
      <FormVeiculo acao={salvarVeiculo.bind(null, null)} rotuloBotao="Cadastrar veículo" />
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
