import { cancelarConvite, removerMembro } from '@/app/(app)/configuracoes/actions'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import type { Membro } from '@/lib/auth/agencia'
import { listarConvitesPendentes, listarEquipe } from '@/lib/equipe/dados'
import { formatarDataHora } from '@/lib/formato'
import { FormConvite } from './FormConvite'

const lista = 'flex flex-col divide-y divide-linha rounded-[--radius-cartao] border border-linha bg-superficie'
const PAPEL = { dono: 'Dono', vendedor: 'Vendedor(a)' } as const

export async function Equipe({ membro }: { membro: Membro }) {
  const ehDono = membro.papel === 'dono'
  const [equipe, convites] = await Promise.all([listarEquipe(), ehDono ? listarConvitesPendentes() : Promise.resolve([])])
  const agora = new Date().toISOString()
  return (
    <>
      <ul className={lista} aria-label="Pessoas da agência">
        {equipe.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>{m.nome} <span className="text-sm text-tinta-suave">· {PAPEL[m.papel]}</span></span>
            {ehDono && m.papel === 'vendedor' && (
              <ConfirmarExclusao acao={removerMembro.bind(null, m.user_id)} rotulo={`Remover acesso de ${m.nome}`} rotuloConfirmar="Remover mesmo"
                aviso="A pessoa perde o acesso à agência. Clientes, negociações e atividades ficam; as dela ficam sem responsável." />
            )}
          </li>
        ))}
      </ul>
      {ehDono ? (
        <>
          {convites.length > 0 && (
            <ul className={lista} aria-label="Convites pendentes">
              {convites.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>{c.nome} · {c.email} · {c.expira_em < agora ? 'vencido' : `vale até ${formatarDataHora(c.expira_em)}`}</span>
                  <form action={cancelarConvite.bind(null, c.id)}>
                    <button type="submit" className="min-h-11 text-despesa underline">Cancelar convite de {c.nome}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <h3 className="font-semibold">Convidar vendedor(a)</h3>
          <FormConvite />
        </>
      ) : (
        <p className="text-sm text-tinta-suave">Só o dono convida ou remove pessoas.</p>
      )}
    </>
  )
}
