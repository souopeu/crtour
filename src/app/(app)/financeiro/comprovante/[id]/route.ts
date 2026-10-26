import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SEGUNDOS_LINK } from '@/lib/comprovantes/comprovantes'
import { BUCKET_COMPROVANTES } from '@/lib/comprovantes/saida'
import { criarClienteServidor } from '@/lib/supabase/server'

// E10-2: receipts of payments the agency made are never public; the owner gets a short-lived signed link (RLS: owner only).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return new NextResponse('Não encontrado', { status: 404 })
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('comprovantes_saida').select('caminho').eq('id', id).maybeSingle()
  if (!data) return new NextResponse('Não encontrado', { status: 404 })
  const { data: link, error } = await supabase.storage.from(BUCKET_COMPROVANTES).createSignedUrl(data.caminho as string, SEGUNDOS_LINK)
  if (error || !link) {
    console.error('comprovante de saída: link falhou', error?.message)
    return new NextResponse('Não foi possível abrir o comprovante', { status: 502 })
  }
  return NextResponse.redirect(link.signedUrl, { status: 307, headers: { 'Cache-Control': 'no-store' } })
}
