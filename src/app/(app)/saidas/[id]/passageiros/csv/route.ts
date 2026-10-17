import { getUsuario } from '@/lib/auth/usuario'
import { buscarSaida, listarPassageirosDaSaida } from '@/lib/passeios/dados'
import { montarCsvPassageiros, montarLista } from '@/lib/passageiros/lista'

export async function GET(_req: Request, ctx: RouteContext<'/saidas/[id]/passageiros/csv'>) {
  if (!(await getUsuario())) return new Response('Não autorizado', { status: 401 })
  const { id } = await ctx.params
  const saida = await buscarSaida(id)
  if (!saida) return new Response('Saída não encontrada', { status: 404 })

  const { reservas, passageiros } = await listarPassageirosDaSaida(saida.id)
  return new Response(montarCsvPassageiros(montarLista(reservas, passageiros)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'private, no-store', // personal data: never cached or shared
      'Content-Disposition': `attachment; filename="passageiros-${saida.data}.csv"`,
    },
  })
}
