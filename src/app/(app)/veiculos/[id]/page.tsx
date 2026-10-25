import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { botaoSecundario } from '@/components/tela/estilos'
import { FormVeiculo } from '@/components/veiculos/FormVeiculo'
import { getMembro } from '@/lib/auth/agencia'
import { buscarVeiculo } from '@/lib/veiculos/dados'
import { rotuloCategoria } from '@/lib/veiculos/veiculos'
import { alternarArquivadoVeiculo, apagarVeiculo, salvarVeiculo } from '../actions'

export const metadata = { title: 'Veículo' }

async function Conteudo({ params }: Pick<PageProps<'/veiculos/[id]'>, 'params'>) {
  const { id } = await params
  const [veiculo, membro] = await Promise.all([buscarVeiculo(id), getMembro()])
  if (!veiculo) notFound()
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/veiculos" className="w-fit text-sm text-primaria underline">← Veículos</Link>
      <CabecalhoPagina area="Operação" titulo={veiculo.nome} descricao={`${rotuloCategoria(veiculo.categoria)} · ${veiculo.lugares} lugares${veiculo.arquivado ? ' · arquivado' : ''}`}>
        <form action={alternarArquivadoVeiculo.bind(null, veiculo.id, !veiculo.arquivado)}>
          <button type="submit" className={botaoSecundario}>{veiculo.arquivado ? 'Reativar' : 'Arquivar'}</button>
        </form>
      </CabecalhoPagina>
      <FormVeiculo acao={salvarVeiculo.bind(null, veiculo.id)} rotuloBotao="Salvar alterações"
        inicial={{ nome: veiculo.nome, categoria: veiculo.categoria, lugares: String(veiculo.lugares) }} />
      {membro?.papel === 'dono' && (
        <ConfirmarExclusao acao={apagarVeiculo.bind(null, veiculo.id)} rotulo="Apagar veículo" rotuloConfirmar="Apagar mesmo"
          aviso="Só dá para apagar um veículo que nunca foi usado em saída. Os usados podem ser arquivados." />
      )}
    </section>
  )
}

export default function VeiculoPage({ params }: PageProps<'/veiculos/[id]'>) {
  return (
    <Suspense fallback={<Carregando altura="h-40" />}>
      <Conteudo params={params} />
    </Suspense>
  )
}
