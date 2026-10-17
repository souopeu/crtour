// LOCAL ONLY: fictional demo agency to look at the app (never run against production).
// Usage: node scripts/seed-demo-local.mjs   (login: demo@crtour.test / demo-crtour-local)
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(execSync('supabase status -o env', { encoding: 'utf8' }).split('\n')
  .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]))
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.API_URL ?? '')) throw new Error('local Supabase only')
const db = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const dias = (n, h = 12) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10) + `T${String(h + 3).padStart(2, '0')}:00:00Z`
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data }

const EMAIL = 'demo@crtour.test'
const { data: lista } = await db.auth.admin.listUsers()
const antigo = lista.users.find((u) => u.email === EMAIL)
if (antigo) {
  const { data: m } = await db.from('membros').select('agencia_id').eq('user_id', antigo.id).maybeSingle()
  for (const t of ['atividades', 'avisos', 'negociacao_eventos', 'negociacoes', 'clientes']) if (m) await db.from(t).delete().eq('agencia_id', m.agencia_id)
  if (m) await db.from('agencias').delete().eq('id', m.agencia_id)
  await db.auth.admin.deleteUser(antigo.id)
}
const user = ok(await db.auth.admin.createUser({ email: EMAIL, password: 'demo-crtour-local', email_confirm: true,
  user_metadata: { agencia_nome: 'Viagens Sol (demo)', nome: 'Dono Demo' } })).user
const agencia_id = ok(await db.from('membros').select('agencia_id').eq('user_id', user.id).single()).agencia_id
await db.from('membros').update({ nome: 'Dono Demo' }).eq('user_id', user.id)

const cli = (nome, whatsapp, consentimento_whatsapp, criado) =>
  ({ agencia_id, nome, whatsapp, consentimento_whatsapp, cidade: 'São Paulo', criado_em: dias(-criado) })
const clientes = ok(await db.from('clientes').insert([
  cli('Ana Souza', '5511999990001', 'aceitou', 60), cli('Bruno Lima', '5511999990002', 'nao_informado', 45),
  cli('Carla Mendes', '5511999990003', 'aceitou', 50), cli('Diego Rocha', null, 'aceitou', 3),
  cli('Elisa Prado', '5511999990005', 'pediu_saida', 90),
]).select('id, nome'))
const id = Object.fromEntries(clientes.map((c) => [c.nome.split(' ')[0], c.id]))
// the insert stamps criado_em = now(); backdate it afterwards
for (const [nome, d] of [['Ana', 60], ['Bruno', 45], ['Carla', 50], ['Elisa', 90]]) await db.from('clientes').update({ criado_em: dias(-d) }).eq('id', id[nome])

const atv = (c, tipo, titulo, quando, status = 'pendente') => ({ agencia_id, cliente_id: id[c], tipo, titulo, quando, status, criado_por: user.id, responsavel_id: user.id })
ok(await db.from('atividades').insert([
  atv('Ana', 'ligacao', 'Ligar para confirmar datas de Lisboa', dias(-2, 10)),
  atv('Carla', 'tarefa', 'Enviar orçamento do cruzeiro', dias(-5, 9)),
  atv('Ana', 'whatsapp', 'Mandar roteiro dia a dia', dias(0, 16)),
  atv('Diego', 'reuniao', 'Reunião sobre lua de mel', dias(0, 18)),
  atv('Diego', 'ligacao', 'Retornar sobre passaporte', dias(3, 10)),
  atv('Ana', 'reuniao', 'Primeira conversa na agência', dias(-20, 15), 'feito'),
  atv('Carla', 'whatsapp', 'Enviou fotos do navio', dias(-38, 11), 'feito'),
]))
const neg = (c, titulo, valor_centavos, etapa) => ({ agencia_id, cliente_id: id[c], titulo, valor_centavos, etapa, responsavel_id: user.id })
const comoDono = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } })
ok(await comoDono.auth.signInWithPassword({ email: EMAIL, password: 'demo-crtour-local' }))
const negs = ok(await comoDono.from('negociacoes').insert([
  neg('Ana', 'Lisboa em março', 1850000, 'orcamento'), neg('Carla', 'Cruzeiro pelo Caribe', 2400000, 'interessado'),
  neg('Bruno', 'Gramado no inverno', 640000, 'reservado'), neg('Diego', 'Lua de mel em Maldivas', 4200000, 'interessado'),
]).select('id, titulo'))
const nid = Object.fromEntries(negs.map((n) => [n.titulo, n.id]))
await db.from('negociacoes').update({ etapa_desde: dias(-12) }).eq('id', nid['Lisboa em março'])
await db.from('negociacoes').update({ etapa_desde: dias(-9) }).eq('id', nid['Cruzeiro pelo Caribe'])
console.log('demo pronta:', clientes.length, 'clientes,', negs.length, 'negociações')
