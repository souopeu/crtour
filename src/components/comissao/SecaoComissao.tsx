import { salvarComissaoPasseio, salvarPercentualMembro } from '@/app/(app)/comissoes/actions'
import type { Membro } from '@/lib/auth/agencia'
import { buscarConfigComissao } from '@/lib/comissao/dados'
import { centavosParaCampo } from '@/lib/passeios/dinheiro'
import { FormRegra } from './FormRegra'
import { FormValor } from './FormValor'

const pct = (n: number) => String(n).replace('.', ',')

// Configurações > Comissão. Only the owner configures it (the database refuses anyone else).
export async function SecaoComissao({ membro }: { membro: Membro }) {
  if (membro.papel !== 'dono') return <p className="text-sm text-tinta-suave">Só o dono configura a comissão. Veja as suas em Comissões.</p>
  const { regra, membros, passeios } = await buscarConfigComissao()
  return (
    <div className="flex flex-col gap-4">
      <FormRegra regra={regra} />
      {regra === 'percentual_vendedor' && (
        <div className="flex flex-col gap-2" role="group" aria-label="Percentual de cada pessoa">
          {membros.map((m) => <FormValor key={m.user_id} acao={salvarPercentualMembro.bind(null, m.user_id)} rotulo={m.nome} inicial={pct(m.comissao_percentual)} sufixo="%" />)}
        </div>
      )}
      {(regra === 'percentual_passeio' || regra === 'valor_por_pessoa') && (
        passeios.length === 0 ? <p className="text-sm text-tinta-suave">Cadastre passeios para definir a comissão de cada um.</p> : (
          <div className="flex flex-col gap-2" role="group" aria-label={regra === 'percentual_passeio' ? 'Percentual de cada passeio' : 'Valor por passageiro de cada passeio'}>
            {passeios.map((p) => regra === 'percentual_passeio'
              ? <FormValor key={p.id} acao={salvarComissaoPasseio.bind(null, p.id, 'percentual')} rotulo={p.nome} inicial={pct(p.comissao_percentual)} sufixo="%" />
              : <FormValor key={p.id} acao={salvarComissaoPasseio.bind(null, p.id, 'por_pessoa')} rotulo={p.nome} inicial={centavosParaCampo(p.comissao_por_pessoa_centavos)} sufixo="R$ por passageiro" />)}
          </div>
        )
      )}
    </div>
  )
}
