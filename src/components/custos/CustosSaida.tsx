import { apagarCusto, marcarCustoPago } from '@/app/(app)/fornecedores/actions'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { margem } from '@/lib/custos/custos'
import { custosDaSaida, listarFornecedores } from '@/lib/custos/dados'
import { formatarDataBr } from '@/lib/formato'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { FormCusto } from './FormCusto'

// R52: costs of the departure and its margin (sold − costs).
export async function CustosSaida({ saidaId }: { saidaId: string }) {
  const [{ custos, receita, custoExtras }, fornecedores] = await Promise.all([custosDaSaida(saidaId), listarFornecedores()])
  const m = margem(receita, custos, custoExtras)
  const nome = new Map(fornecedores.map((f) => [f.id, f.nome]))
  return (
    <section aria-labelledby="custos-titulo" className="flex flex-col gap-3">
      <h2 id="custos-titulo" className="text-lg font-semibold">Custos e margem</h2>
      <dl className="grid grid-cols-2 gap-2 rounded-[--radius-cartao] border border-linha bg-superficie p-3 text-sm sm:grid-cols-4">
        <div><dt className="text-tinta-suave">Vendido</dt><dd className="font-semibold">{formatarReais(m.receita)}</dd></div>
        <div><dt className="text-tinta-suave">Custos</dt><dd className="font-semibold">{formatarReais(m.custos)}{m.custoExtras > 0 && <span className="block text-xs font-normal text-tinta-suave">inclui {formatarReais(m.custoExtras)} de extras vendidos</span>}</dd></div>
        <div><dt className="text-tinta-suave">Margem</dt><dd className={`font-semibold ${m.margem < 0 ? 'text-despesa' : 'text-receita'}`}>{formatarReais(m.margem)}{m.percentual !== null && ` (${Math.round(m.percentual * 100)}%)`}</dd></div>
        <div><dt className="text-tinta-suave">Custos a pagar</dt><dd className="font-semibold">{formatarReais(m.aPagar)}</dd></div>
      </dl>
      {custos.length > 0 && (
        <ul aria-label="Custos da saída" className="flex flex-col gap-2">
          {custos.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3 text-sm">
              <p><strong>{c.descricao}</strong> · {formatarReais(c.valor_centavos)}{c.fornecedor_id && ` · ${nome.get(c.fornecedor_id) ?? 'Fornecedor'}`}</p>
              <p className="text-tinta-suave">
                {c.pago_em ? `Pago em ${formatarDataBr(c.pago_em)}` : `A pagar${c.vencimento ? `, vence em ${formatarDataBr(c.vencimento)}` : ''}`}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {!c.pago_em && (
                  <form action={marcarCustoPago.bind(null, saidaId, c.id)}>
                    <button type="submit" className="min-h-11 text-primaria underline">Marcar como pago hoje</button>
                  </form>
                )}
                <ConfirmarExclusao acao={apagarCusto.bind(null, saidaId, c.id)} rotulo={`Apagar custo ${c.descricao}`} rotuloConfirmar="Apagar mesmo" aviso="Apaga este custo da saída." />
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormCusto saidaId={saidaId} fornecedores={fornecedores.map((f) => ({ id: f.id, nome: f.nome }))} />
    </section>
  )
}
