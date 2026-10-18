import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SEGUNDOS_LINK } from '@/lib/comprovantes/comprovantes'
import { criarClienteServidor } from '@/lib/supabase/server'

// R94: the receipt is never public; members get a short-lived signed link (RLS finds the row only inside the agency).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return new NextResponse('Não encontrado', { status: 404 })
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('comprovantes').select('caminho').eq('pagamento_id', id).maybeSingle()
  if (!data) return new NextResponse('Não encontrado', { status: 404 })
  const { data: link, error } = await supabase.storage.from('comprovantes').createSignedUrl(data.caminho as string, SEGUNDOS_LINK)
  if (error || !link) {
    console.error('comprovante: link falhou', error?.message)
    return new NextResponse('Não foi possível abrir o comprovante', { status: 502 })
  }
  return NextResponse.redirect(link.signedUrl, { status: 307, headers: { 'Cache-Control': 'no-store' } })
}
