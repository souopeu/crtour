import { CampoCopiar } from '@/components/formulario/CampoCopiar'
import { FormProposta } from '@/components/propostas/FormProposta'
import { AcoesProposta } from '@/components/propostas/AcoesProposta'
import { criarProposta } from '@/app/(app)/negociacoes/propostas-actions'
import { getAgenciaId } from '@/lib/auth/agencia'
import { siteDaRequisicao } from '@/lib/auth/siteDaRequisicao'
import { estadoDoBotao, linkWhatsapp } from '@/lib/clientes/whatsappLink'
import { formatarDataBr, formatarDataHora, hojeNoBrasil } from '@/lib/formato'
import type { NegociacaoLinha } from '@/lib/negociacoes/dados'
import { centavosParaCampo, formatarReais } from '@/lib/passeios/dinheiro'
import { contextoDaNegociacao, listarPropostas } from '@/lib/propostas/dados'
import { mensagemProposta, situacaoProposta } from '@/lib/propostas/proposta'

const VALIDADE_PADRAO_DIAS = 7
const maisDias = (iso: string, dias: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10)

// R69, R70: proposals of a deal: create (values frozen), copy the link, send by WhatsApp, revoke.
export async function PropostasNegociacao({ n }: { n: NegociacaoLinha }) {
  const agenciaId = await getAgenciaId()
  const [propostas, c, site] = await Promise.all([listarPropostas(n.id), agenciaId ? contextoDaNegociacao(agenciaId, n) : null, siteDaRequisicao()])
  const hoje = hojeNoBrasil()
  const pessoas = c?.cliente.qtd_pessoas ?? 1
  const total = n.valor_centavos > 0 ? n.valor_centavos : c?.saida ? pessoas * c.saida.preco_centavos : 0
  const botao = c ? estadoDoBotao(c.cliente.whatsapp, c.cliente.consentimento_whatsapp) : null

  return (
    <section aria-labelledby="propostas-titulo" className="flex flex-col gap-4 rounded-(--radius-cartao) border border-linha bg-superficie p-5">
      <h2 id="propostas-titulo" className="text-lg font-semibold">Propostas</h2>
      {propostas.length > 0 && (
        <ul className="flex flex-col gap-3">
          {propostas.map((p) => {
            const situacao = situacaoProposta(p, hoje)
            const url = site ? `${site}/p/${p.codigo}` : null
            const whats = situacao === 'valida' && url && botao?.habilitado && c ? linkWhatsapp(c.cliente.whatsapp, mensagemProposta(c.cliente.nome, url, p.validade)) : null
            return (
              <li key={p.id} className={`flex flex-col gap-2 rounded-lg border border-l-4 border-linha p-3 ${situacao === 'valida' ? 'border-l-primaria' : 'border-l-controle'}`}>
                <p className="text-sm">
                  <strong>{formatarReais(p.dados.totalCentavos)}</strong> · {p.dados.pessoas} {p.dados.pessoas === 1 ? 'pessoa' : 'pessoas'} ·{' '}
                  {situacao === 'valida' ? `Válida até ${formatarDataBr(p.validade)}` : situacao === 'vencida' ? `Vencida em ${formatarDataBr(p.validade)}` : 'Revogada'}
                  {p.enviada_em && <span className="text-tinta-suave"> · enviada em {formatarDataHora(p.enviada_em)}</span>}
                </p>
                {situacao === 'valida' && url && (
                  <>
                    <CampoCopiar id={`link-${p.id}`} rotulo="Link da proposta" valor={url} />
                    <div className="flex flex-wrap items-center gap-3">
                      {whats
                        ? <a href={whats} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-destaque px-5 font-semibold text-destaque-texto">Enviar pelo WhatsApp</a>
                        : <span className="text-sm text-despesa">{botao?.habilitado === false && botao.motivo === 'pediu_saida' ? 'O cliente pediu para não receber mensagens.' : 'Cliente sem WhatsApp cadastrado.'}</span>}
                      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-primaria underline">Abrir proposta</a>
                    </div>
                    <AcoesProposta propostaId={p.id} />
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-col gap-3 border-t border-linha pt-3">
        <h3 className="font-semibold">Nova proposta</h3>
        {c?.saida
          ? <p className="text-sm text-tinta-suave">Vai copiar {c.saida.passeio.nome} · saída de {formatarDataBr(c.saida.data)} e o que o passeio inclui.</p>
          : <p className="text-sm text-tinta-suave">Negociação sem saída: a proposta leva só os valores. Ligue uma saída nos dados da negociação para incluir o passeio.</p>}
        <FormProposta acao={criarProposta.bind(null, n.id)} inicial={{
          pessoas: String(pessoas), total: total > 0 ? centavosParaCampo(total) : '', sinal: '', sinalAte: '', saldoAte: '',
          validade: maisDias(hoje, VALIDADE_PADRAO_DIAS), observacoes: '',
        }} />
      </div>
    </section>
  )
}
