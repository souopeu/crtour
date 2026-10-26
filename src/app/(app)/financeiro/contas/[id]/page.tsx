import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { FormConta } from '@/components/contas/FormConta'
import { PagarLinha } from '@/components/contas/PagarLinha'
import { SoDono } from '@/components/financeiro/SoDono'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { botaoSecundario, cartaoFiltros } from '@/components/tela/estilos'
import { getMembro } from '@/lib/auth/agencia'
import { rotuloCategoriaConta, textoParcela } from '@/lib/contas/contas'
import { buscarConta } from '@/lib/contas/dados'
import { listarFornecedores } from '@/lib/custos/dados'
import { formatarDataBr, hojeNoBrasil } from '@/lib/formato'
import { centavosParaCampo, formatarReais } from '@/lib/passeios/dinheiro'
import { desfazerPagamento, editarConta, excluirConta, pagar, pararRecorrencia } from '../actions'

export const metadata = { title: 'Conta a pagar' }

const FORMA = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro' } as const

async function Conteudo({ params }: Pick<PageProps<'/financeiro/contas/[id]'>, 'params'>) {
  const [{ id }, membro] = await Promise.all([params, getMembro()])
  if (membro?.papel !== 'dono') return <SoDono />
  const [conta, fornecedores] = await Promise.all([buscarConta(id), listarFornecedores()])
  if (!conta) notFound()
  await connection()
  const hoje = hojeNoBrasil()
  const parcela = textoParcela({ parcela: conta.parcela, total: conta.total_parcelas, recorrente: conta.recorrente })
  return (
    <>
      <CabecalhoPagina area="Financeiro" titulo={conta.descricao}
        descricao={`${rotuloCategoriaConta(conta.categoria)} · ${formatarReais(conta.valor_centavos)} · vence em ${formatarDataBr(conta.vencimento)}${parcela ? ` · ${parcela}` : ''}`} />
      <section aria-labelledby="pagamento-titulo" className={cartaoFiltros}>
        <h2 id="pagamento-titulo" className="text-lg font-semibold">Pagamento</h2>
        {conta.pago_em ? (
          <div className="flex flex-wrap items-center gap-3">
            <p>Paga em <strong>{formatarDataBr(conta.pago_em)}</strong>{conta.forma_pago && <> · {FORMA[conta.forma_pago]}</>}</p>
            <ConfirmarExclusao acao={desfazerPagamento.bind(null, conta.id)} rotulo="Desfazer pagamento" rotuloConfirmar="Desfazer mesmo" rotuloVoltar="Voltar"
              aviso="A conta volta para a lista do que falta pagar." />
          </div>
        ) : <PagarLinha acao={pagar.bind(null, 'conta', conta.id)} hoje={hoje} descricao={conta.descricao} comForma />}
      </section>
      {conta.recorrente && conta.grupo_id && (
        <form action={pararRecorrencia.bind(null, conta.id, conta.grupo_id)} className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-tinta-suave">Esta conta se repete todo mês.</p>
          <button type="submit" className={botaoSecundario}>Parar de repetir</button>
        </form>
      )}
      <section aria-labelledby="dados-titulo" className="flex flex-col gap-3">
        <h2 id="dados-titulo" className="text-lg font-semibold">Dados da conta</h2>
        {conta.grupo_id && <p className="text-sm text-tinta-suave">Mudar aqui altera só esta {conta.total_parcelas ? 'parcela' : 'conta do mês'}.</p>}
        <FormConta acao={editarConta.bind(null, conta.id)} fornecedores={fornecedores} comModo={false} rotuloBotao="Salvar alterações"
          inicial={{ descricao: conta.descricao, categoria: conta.categoria, valor: centavosParaCampo(conta.valor_centavos), vencimento: conta.vencimento, fornecedor: conta.fornecedor_id ?? '', observacao: conta.observacao ?? '' }} />
      </section>
      <div className="flex flex-col gap-2">
        <ConfirmarExclusao acao={excluirConta.bind(null, conta.id, false)} rotulo={conta.grupo_id ? 'Excluir só esta' : 'Excluir conta'} aviso="Apaga esta conta. Não dá para desfazer." />
        {conta.grupo_id && (
          <ConfirmarExclusao acao={excluirConta.bind(null, conta.id, true)} rotulo="Excluir esta e as próximas" rotuloConfirmar="Excluir todas"
            aviso={conta.recorrente ? 'Apaga esta conta e as dos meses seguintes já criadas, e a série para de repetir.' : 'Apaga esta parcela e as seguintes.'} />
        )}
      </div>
    </>
  )
}

export default function ContaPage({ params }: PageProps<'/financeiro/contas/[id]'>) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/financeiro/contas" className="w-fit text-sm text-primaria underline">← Contas a pagar</Link>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Conteudo params={params} />
      </Suspense>
    </section>
  )
}
