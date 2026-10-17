import type { NextRequest } from 'next/server'
import { getMembro } from '@/lib/auth/agencia'
import {
  exportarAcompanhantes, exportarAnotacoes, exportarClientes, exportarPagamentos, exportarReservas,
} from '@/lib/exportacao/dados'

// Never cached or shared: it carries the agency's personal data.
const CABECALHOS = { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'private, no-store' }

export async function GET(request: NextRequest) {
  const membro = await getMembro()
  if (!membro) return new Response('Não autorizado', { status: 401 })
  if (membro.papel !== 'dono') return new Response('Só o dono da agência baixa os dados.', { status: 403 }) // R41

  const EXPORTADORES = {
    clientes: exportarClientes, anotacoes: exportarAnotacoes, reservas: exportarReservas,
    pagamentos: exportarPagamentos, acompanhantes: exportarAcompanhantes,
  } as const
  const pedido = request.nextUrl.searchParams.get('tipo') ?? 'clientes'
  const tipo = (pedido in EXPORTADORES ? pedido : 'clientes') as keyof typeof EXPORTADORES
  try {
    const csv = await EXPORTADORES[tipo]()
    const dia = new Date().toISOString().slice(0, 10)
    return new Response(csv, {
      headers: { ...CABECALHOS, 'Content-Disposition': `attachment; filename="${tipo}-crtour-${dia}.csv"` },
    })
  } catch (erro) {
    console.error('exportar falhou', erro instanceof Error ? erro.message : 'erro')
    return new Response('Não foi possível exportar agora. Tente novamente.', { status: 500 })
  }
}
