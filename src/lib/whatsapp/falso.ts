import { obterProvedorWhatsapp, type ProvedorWhatsapp } from './whatsapp'

type Env = Record<string, string | undefined>
const SUPABASE_LOCAL = /^http:\/\/(127\.0\.0\.1|localhost):/

// Test-only provider for the local e2e (spec 19, R105): it "sends" nothing. It exists only with the test flag AND a local
// database, so a stray flag in production cannot fake a send. It never accepts a notice, so the webhook stays closed.
function provedorFalsoLocal(env: Env): ProvedorWhatsapp | null {
  if (env.WHATSAPP_FALSO_LOCAL !== '1' || !SUPABASE_LOCAL.test(env.NEXT_PUBLIC_SUPABASE_URL ?? '')) return null
  const enviar = async (conteudo: string) => {
    if (conteudo.includes('[falha]')) throw new Error('falha simulada')
    return { idExterno: `falso-${crypto.randomUUID()}` }
  }
  return {
    nome: 'falso',
    enviarTexto: ({ texto }) => enviar(texto),
    enviarModelo: ({ modelo }) => enviar(modelo),
    validarAviso: async () => null,
  }
}

// The provider used to send from the inbox: the configured one, else the local test fake, else none.
export function provedorDeEnvio(env: Env): ProvedorWhatsapp | null {
  return obterProvedorWhatsapp(env) ?? provedorFalsoLocal(env)
}
