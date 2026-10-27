import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { FormExtra } from '@/components/extras/FormExtra'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { getMembro } from '@/lib/auth/agencia'
import { buscarExtra, listarPasseiosParaExtra } from '@/lib/extras/dados'
import { centavosParaCampo } from '@/lib/passeios/dinheiro'
import { salvarExtra } from '../actions'

export const metadata = { title: 'Extra' }

async function Conteudo({ params }: Pick<PageProps<'/extras/[id]'>, 'params'>) {
  const { id } = await params
  const [extra, passeios, membro] = await Promise.all([buscarExtra(id), listarPasseiosParaExtra(), getMembro()])
  if (!extra) notFound()
  return (
    <>
      <CabecalhoPagina area="Catálogo · Extras" titulo={extra.nome} descricao="Mudar o preço vale para as próximas vendas; reservas já feitas não mudam." />
      <FormExtra acao={salvarExtra.bind(null, extra.id)} passeios={passeios} mostrarCusto={membro?.papel === 'dono'} rotuloBotao="Salvar alterações"
        inicial={{
          nome: extra.nome, preco: centavosParaCampo(extra.preco_centavos), cobranca: extra.cobranca,
          custo: extra.custo_centavos === null ? '' : centavosParaCampo(extra.custo_centavos),
          todos: extra.todos_passeios ? '1' : '', passeios: extra.passeios.join(','),
        }} />
    </>
  )
}

export default function ExtraPage({ params }: PageProps<'/extras/[id]'>) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  )
}
