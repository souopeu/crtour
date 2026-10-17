import { gerarModelo } from '@/lib/importacao/modelo'

export async function GET() {
  const arquivo = await gerarModelo()
  return new Response(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="modelo-importacao-crtour.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  })
}
