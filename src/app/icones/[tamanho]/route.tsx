import { ImageResponse } from 'next/og'

// Maskable icons keep the symbol small so system crops don't cut it.
const ICONS: Record<string, { size: number; symbol: number }> = {
  '180': { size: 180, symbol: 0.62 },
  '192': { size: 192, symbol: 0.62 },
  '512': { size: 512, symbol: 0.62 },
  maskable: { size: 512, symbol: 0.5 },
}

export async function GET(_req: Request, ctx: RouteContext<'/icones/[tamanho]'>) {
  const { tamanho } = await ctx.params
  const icon = ICONS[tamanho]
  if (!icon) return new Response('Not found', { status: 404 })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1d4ed8',
          color: '#facc15',
          fontSize: icon.size * icon.symbol,
          fontWeight: 800,
        }}
      >
        cr
      </div>
    ),
    { width: icon.size, height: icon.size },
  )
}
