import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { relogioAutorizado } from '@/lib/lembretes/relogio'
import { configVapid, enviarPushes, type LinhaPush } from '@/lib/push/push'

const VALIDADE_PUSH_S = 60 * 60 // a reminder older than 1 hour is not worth delivering late

// R132: called every 5 minutes by the scheduler; creates the reminders (R129) and pushes new notices to devices (R131).
// Server to server only: the session is not used, the secret is; the service key never reaches the browser.
export async function GET(request: Request) {
  if (!relogioAutorizado(request.headers.get('authorization'), process.env.CRON_SECRET)) return new Response(null, { status: 401 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) return Response.json({ erro: 'sem_chave_servico' }, { status: 503 })
  const admin = createClient(url, chave, { auth: { persistSession: false } })
  const { data: criados, error } = await admin.rpc('gerar_lembretes')
  if (error) {
    console.error('gerar_lembretes falhou', error.code)
    return Response.json({ erro: 'falhou' }, { status: 500 })
  }

  // Without VAPID keys the queue is left alone (nothing is marked as pushed).
  const vapid = configVapid(process.env)
  if (!vapid) return Response.json({ criados, push: 'desligado' })
  const fila = await admin.rpc('pegar_pushes_pendentes')
  if (fila.error) {
    console.error('pegar_pushes_pendentes falhou', fila.error.code)
    return Response.json({ criados, push: 'falhou' })
  }
  webpush.setVapidDetails(vapid.contato, vapid.publica, vapid.privada)
  const r = await enviarPushes((fila.data ?? []) as LinhaPush[], async (inscricao, corpo) => {
    await webpush.sendNotification(inscricao, corpo, { TTL: VALIDADE_PUSH_S })
  })
  if (r.sumidas.length) {
    const { error: e } = await admin.rpc('apagar_inscricoes_push', { p_ids: r.sumidas })
    if (e) console.error('apagar_inscricoes_push falhou', e.code)
  }
  if (r.falhas) console.error('push: envios que falharam', r.falhas)
  return Response.json({ criados, push: { enviados: r.enviados, falhas: r.falhas, removidos: r.sumidas.length } })
}
