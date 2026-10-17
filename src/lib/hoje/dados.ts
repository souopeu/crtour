import 'server-only'
import { listarMembros } from '@/lib/negociacoes/dados'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { TipoAtividade } from '@/lib/atividades/atividades'

export type Limites = { dias_sem_contato: number; dias_negociacao_parada: number }
export type ClienteContato = { id: string; nome: string; whatsapp: string | null; consentimento_whatsapp: string }
export type PendenteLinha = {
  id: string; tipo: TipoAtividade; titulo: string; quando: string; cliente: ClienteContato; responsavel_nome: string | null; motivo: string | null
}
export type SemContatoLinha = ClienteContato & { ultima_interacao_em: string | null; criado_em: string }

const PADRAO: Limites = { dias_sem_contato: 30, dias_negociacao_parada: 7 }
const LIMITE_LISTA = 100 // shortcut: shows the 100 oldest, says how many more; paginate if agencies get bigger

export async function buscarLimites(): Promise<Limites> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('agencias').select('dias_sem_contato, dias_negociacao_parada').maybeSingle()
  return (data as Limites | null) ?? PADRAO
}

// Pending activities scheduled before `ate` (end of today in Brazil), with the client's contact data.
// `somenteDe`: only activities in that person's charge (or unassigned ones they created).
export async function listarPendentesAte(ate: string, somenteDe?: string): Promise<PendenteLinha[]> {
  const supabase = await criarClienteServidor()
  let consulta = supabase
    .from('atividades')
    .select('id, tipo, titulo, quando, cliente_id, responsavel_id, motivo')
    .eq('status', 'pendente')
    .lt('quando', ate)
    .order('quando')
    .limit(LIMITE_LISTA)
  if (somenteDe) consulta = consulta.or(`responsavel_id.eq.${somenteDe},and(responsavel_id.is.null,criado_por.eq.${somenteDe})`)
  const { data } = await consulta
  const linhas = (data ?? []) as { id: string; tipo: TipoAtividade; titulo: string; quando: string; cliente_id: string; responsavel_id: string | null; motivo: string | null }[]
  if (linhas.length === 0) return []

  const [clientes, membros] = await Promise.all([
    supabase.from('clientes').select('id, nome, whatsapp, consentimento_whatsapp').in('id', [...new Set(linhas.map((l) => l.cliente_id))]),
    listarMembros(),
  ])
  const cliente = new Map(((clientes.data ?? []) as ClienteContato[]).map((c) => [c.id, c]))
  const nome = new Map(membros.map((m) => [m.user_id, m.nome]))
  return linhas.flatMap((l) => {
    const c = cliente.get(l.cliente_id)
    if (!c) return []
    return [{ id: l.id, tipo: l.tipo, titulo: l.titulo, quando: l.quando, cliente: c, responsavel_nome: l.responsavel_id ? (nome.get(l.responsavel_id) ?? null) : null, motivo: l.motivo }]
  })
}

// Clients whose last interaction (or, if none, their registration) is before `limite`.
// Who asked not to receive messages is left out: the list exists to prompt a contact.
export async function listarSemContato(limite: string): Promise<{ clientes: SemContatoLinha[]; total: number }> {
  const supabase = await criarClienteServidor()
  const { data, count } = await supabase
    .from('clientes')
    .select('id, nome, whatsapp, consentimento_whatsapp, ultima_interacao_em, criado_em', { count: 'exact' })
    .neq('consentimento_whatsapp', 'pediu_saida')
    .or(`ultima_interacao_em.lt."${limite}",and(ultima_interacao_em.is.null,criado_em.lt."${limite}")`)
    .order('ultima_interacao_em', { ascending: true, nullsFirst: true })
    .order('criado_em')
    .limit(LIMITE_LISTA)
  return { clientes: (data ?? []) as SemContatoLinha[], total: count ?? 0 }
}
