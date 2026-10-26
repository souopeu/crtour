import type { NextRequest } from 'next/server'
import { getMembro } from '@/lib/auth/agencia'
import { dreCsv, lerPeriodoDre, montarDre } from '@/lib/financeiro/dre'
import { itensDre } from '@/lib/financeiro/dreDados'
import { hojeNoBrasil } from '@/lib/formato'

// R154: the DRE on screen, as CSV. Never cached: it carries the agency's numbers.
export async function GET(request: NextRequest) {
  const membro = await getMembro()
  if (!membro) return new Response('Não autorizado', { status: 401 })
  if (membro.papel !== 'dono') return new Response('Só o dono vê o financeiro da agência.', { status: 403 })
  const periodo = lerPeriodoDre(Object.fromEntries(request.nextUrl.searchParams), hojeNoBrasil())
  try {
    const csv = dreCsv(montarDre(await itensDre(periodo)), periodo)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="dre-${periodo.base}-${periodo.de}-a-${periodo.ate}.csv"`,
      },
    })
  } catch (erro) {
    console.error('dre csv falhou', erro instanceof Error ? erro.message : 'erro')
    return new Response('Não foi possível exportar agora. Tente novamente.', { status: 500 })
  }
}
