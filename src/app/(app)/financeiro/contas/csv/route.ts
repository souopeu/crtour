import type { NextRequest } from 'next/server'
import { getMembro } from '@/lib/auth/agencia'
import { filtrarAPagar, lerFiltroAPagar } from '@/lib/contas/contas'
import { listarAPagar } from '@/lib/contas/dados'
import { aPagarCsv } from '@/lib/financeiro/dre'
import { hojeNoBrasil } from '@/lib/formato'

// R154: the A pagar list with the same filters as the screen, as CSV. Never cached.
export async function GET(request: NextRequest) {
  const membro = await getMembro()
  if (!membro) return new Response('Não autorizado', { status: 401 })
  if (membro.papel !== 'dono') return new Response('Só o dono vê o financeiro da agência.', { status: 403 })
  const hoje = hojeNoBrasil()
  try {
    const linhas = filtrarAPagar(await listarAPagar(), lerFiltroAPagar(Object.fromEntries(request.nextUrl.searchParams)), hoje)
    return new Response(aPagarCsv(linhas, hoje), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="contas-a-pagar-crtour-${hoje}.csv"`,
      },
    })
  } catch (erro) {
    console.error('contas csv falhou', erro instanceof Error ? erro.message : 'erro')
    return new Response('Não foi possível exportar agora. Tente novamente.', { status: 500 })
  }
}
