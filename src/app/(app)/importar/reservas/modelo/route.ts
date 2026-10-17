import { gerarModeloReservas } from '@/lib/importacao/modeloReservas'

export async function GET() {
  const arquivo = await gerarModeloReservas()
  return new Response(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="modelo-reservas-crtour.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  })
}
