import { createClient } from '@supabase/supabase-js'
import { relogioAutorizado } from '@/lib/lembretes/relogio'

// R132: called every 5 minutes by the scheduler; creates the reminders (R129). Server to server only:
// the session is not used, the secret is; the service key never reaches the browser.
export async function GET(request: Request) {
  if (!relogioAutorizado(request.headers.get('authorization'), process.env.CRON_SECRET)) return new Response(null, { status: 401 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) return Response.json({ erro: 'sem_chave_servico' }, { status: 503 })
  const admin = createClient(url, chave, { auth: { persistSession: false } })
  const { data, error } = await admin.rpc('gerar_lembretes')
  if (error) {
    console.error('gerar_lembretes falhou', error.code)
    return Response.json({ erro: 'falhou' }, { status: 500 })
  }
  return Response.json({ criados: data })
}
