import { criarVoucher } from '@/app/(app)/reservas/vouchers-actions'
import { CampoCopiar } from '@/components/formulario/CampoCopiar'
import { AcoesVoucher } from '@/components/vouchers/AcoesVoucher'
import { FormVoucher } from '@/components/vouchers/FormVoucher'
import { siteDaRequisicao } from '@/lib/auth/siteDaRequisicao'
import { estadoDoBotao, linkWhatsapp } from '@/lib/clientes/whatsappLink'
import { formatarDataHora } from '@/lib/formato'
import { contextoDaReserva, listarVouchers } from '@/lib/vouchers/dados'
import { mensagemVoucher } from '@/lib/vouchers/voucher'

// R76: vouchers of a reservation: issue (values frozen, only when fully paid), copy the link, send by WhatsApp, revoke.
export async function VouchersReserva({ reservaId, quitada }: { reservaId: string; quitada: boolean }) {
  const [vouchers, c, site] = await Promise.all([listarVouchers(reservaId), contextoDaReserva(reservaId), siteDaRequisicao()])
  const botao = c ? estadoDoBotao(c.cliente.whatsapp, c.cliente.consentimento_whatsapp) : null
  return (
    <section aria-labelledby="vouchers-titulo" className="flex flex-col gap-4">
      <h2 id="vouchers-titulo" className="text-lg font-semibold">Voucher</h2>
      {vouchers.length > 0 && (
        <ul className="flex flex-col gap-3">
          {vouchers.map((v) => {
            const ativo = v.revogado_em === null
            const url = site ? `${site}/v/${v.codigo}` : null
            const whats = ativo && url && botao?.habilitado && c ? linkWhatsapp(c.cliente.whatsapp, mensagemVoucher(c.cliente.nome, url, v.dados.passeio)) : null
            return (
              <li key={v.id} className={`flex flex-col gap-2 rounded-lg border border-l-4 border-linha p-3 ${ativo ? 'border-l-primaria' : 'border-l-controle'}`}>
                <p className="text-sm">
                  {ativo ? 'Ativo' : 'Revogado'} · criado em {formatarDataHora(v.criado_em)}
                  {v.enviado_em && <span className="text-tinta-suave"> · enviado em {formatarDataHora(v.enviado_em)}</span>}
                </p>
                {ativo && url && (
                  <>
                    <CampoCopiar id={`link-${v.id}`} rotulo="Link do voucher" valor={url} />
                    <div className="flex flex-wrap items-center gap-3">
                      {whats
                        ? <a href={whats} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-destaque px-5 font-semibold text-destaque-texto">Enviar pelo WhatsApp</a>
                        : <span className="text-sm text-despesa">{botao?.habilitado === false && botao.motivo === 'pediu_saida' ? 'O cliente pediu para não receber mensagens.' : 'Cliente sem WhatsApp cadastrado.'}</span>}
                      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-primaria underline">Abrir voucher</a>
                    </div>
                    <AcoesVoucher voucherId={v.id} />
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {quitada
        ? <div className="flex flex-col gap-3"><h3 className="font-semibold">Novo voucher</h3><FormVoucher acao={criarVoucher.bind(null, reservaId)} /></div>
        : <p className="text-sm text-tinta-suave">O voucher só pode ser criado depois que a reserva estiver quitada.</p>}
    </section>
  )
}
