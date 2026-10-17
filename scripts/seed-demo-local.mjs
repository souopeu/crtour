// LOCAL ONLY: fictional agency "after a month of use", for Part C of the demo (never run against production).
// Usage: node scripts/seed-demo-local.mjs   (login: demo@crtour.test / demo-crtour-local)
// Re-running wipes the previous demo agency first (through the app's own "delete my account").
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(execSync('supabase status -o env', { encoding: 'utf8' }).split('\n')
  .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]))
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.API_URL ?? '')) throw new Error('local Supabase only')
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const dono = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } })
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data }
const DIA = 86_400_000
const instante = (n, h = 12) => new Date(Date.now() + n * DIA).toISOString().slice(0, 10) + `T${String(h + 3).padStart(2, '0')}:00:00Z` // h = Brazil hour
const data = (n) => new Date(Date.now() + n * DIA - 3 * 3_600_000).toISOString().slice(0, 10)
const mesAtual = data(0).slice(0, 7)

const EMAIL = 'demo@crtour.test'
const SENHA = 'demo-crtour-local'
if (!(await dono.auth.signInWithPassword({ email: EMAIL, password: SENHA })).error) { // a previous run exists
  ok(await dono.rpc('excluir_minha_conta'))
  await dono.auth.signOut()
}
const user = ok(await admin.auth.admin.createUser({ email: EMAIL, password: SENHA, email_confirm: true,
  user_metadata: { agencia_nome: 'Viagens Sol (demo)', nome: 'Dono Demo' } })).user
ok(await dono.auth.signInWithPassword({ email: EMAIL, password: SENHA }))
const agencia_id = ok(await dono.from('membros').select('agencia_id').eq('user_id', user.id).single()).agencia_id

// Clients (registration dates backdated afterwards: the insert stamps "now")
const C = [
  { nome: 'Ana Souza', whatsapp: '5511999990001', consentimento_whatsapp: 'aceitou', destinos_interesse: ['Lisboa', 'Porto'], aniversario: `1988-${mesAtual.slice(5)}-20`, criado: 60 },
  { nome: 'Bruno Lima', whatsapp: '5511999990002', consentimento_whatsapp: 'nao_informado', destinos_interesse: ['Gramado'], criado: 45 },
  { nome: 'Carla Mendes', whatsapp: '5511999990003', consentimento_whatsapp: 'aceitou', destinos_interesse: ['Caribe'], criado: 50 },
  { nome: 'Diego Rocha', whatsapp: null, consentimento_whatsapp: 'aceitou', destinos_interesse: ['Maldivas'], criado: 3 },
  { nome: 'Elisa Prado', whatsapp: '5511999990005', consentimento_whatsapp: 'pediu_saida', destinos_interesse: ['Lisboa'], criado: 90 },
  { nome: 'Fábio Nunes', whatsapp: '5511999990006', consentimento_whatsapp: 'aceitou', destinos_interesse: ['Lisboa', 'Madri'], passaporte_validade: data(90), criado: 10 },
  { nome: 'Gabi Torres', whatsapp: '5511999990007', consentimento_whatsapp: 'aceitou', destinos_interesse: ['Lisboa'], criado: 70 },
]
const criados = ok(await admin.from('clientes').insert(C.map(({ criado, ...c }) => ({ ...c, agencia_id, cidade: 'São Paulo' }))).select('id, nome'))
const id = Object.fromEntries(criados.map((c) => [c.nome.split(' ')[0], c.id]))
for (const c of C) await admin.from('clientes').update({ criado_em: instante(-c.criado) }).eq('id', id[c.nome.split(' ')[0]])

// Activities: late, today, future, and past contacts (these set "última interação")
const atv = (c, tipo, titulo, quando, status = 'pendente') => ({ agencia_id, cliente_id: id[c], tipo, titulo, quando, status, criado_por: user.id, responsavel_id: user.id })
ok(await admin.from('atividades').insert([
  atv('Ana', 'ligacao', 'Ligar para confirmar datas de Lisboa', instante(-2, 10)),
  atv('Carla', 'tarefa', 'Enviar orçamento do cruzeiro', instante(-5, 9)),
  atv('Ana', 'whatsapp', 'Mandar roteiro dia a dia', instante(0, 16)),
  atv('Diego', 'reuniao', 'Reunião sobre lua de mel', instante(0, 18)),
  atv('Diego', 'ligacao', 'Retornar sobre passaporte', instante(3, 10)),
  atv('Ana', 'reuniao', 'Primeira conversa na agência', instante(-20, 15), 'feito'),
  atv('Carla', 'whatsapp', 'Enviou fotos do navio', instante(-38, 11), 'feito'),
  atv('Fábio', 'whatsapp', 'Pediu ideias para Lisboa', instante(-4, 11), 'feito'),
]))

// Deals (as the owner, like the app). Created before the reservations, so those can suggest the next stage.
const neg = (c, titulo, valor_centavos, etapa) => ({ agencia_id, cliente_id: id[c], titulo, valor_centavos, etapa, responsavel_id: user.id })
const negs = ok(await dono.from('negociacoes').insert([
  neg('Ana', 'Lisboa em março', 1850000, 'orcamento'), neg('Carla', 'Cruzeiro pelo Caribe', 2400000, 'interessado'),
  neg('Bruno', 'Gramado no inverno', 640000, 'reservado'), neg('Diego', 'Lua de mel em Maldivas', 4200000, 'interessado'),
  neg('Ana', 'Porto em família', 1200000, 'reservado'), neg('Carla', 'Cancún no feriado', 900000, 'orcamento'),
]).select('id, titulo'))
const nid = Object.fromEntries(negs.map((n) => [n.titulo, n.id]))
ok(await dono.from('negociacoes').update({ etapa: 'pago' }).eq('id', nid['Porto em família'])) // won this month (owner gets a notice)
ok(await dono.from('negociacoes').update({ etapa: 'perdido', motivo_perda: 'achou_caro' }).eq('id', nid['Cancún no feriado']))
await admin.from('negociacoes').update({ etapa_desde: instante(-12) }).eq('id', nid['Lisboa em março']) // stalled
await admin.from('negociacoes').update({ etapa_desde: instante(-9) }).eq('id', nid['Cruzeiro pelo Caribe']) // stalled
ok(await dono.from('metas').insert({ agencia_id, mes: `${mesAtual}-01`, valor_centavos: 5000000 }))

// Tours, departures, reservations and payments (through the same database functions as the app)
async function saida(nome, dias, capacidade, preco) {
  const p = ok(await dono.from('passeios').insert({ agencia_id, nome, destino: nome }).select('id').single())
  return ok(await dono.from('saidas').insert({ agencia_id, passeio_id: p.id, data: data(dias), capacidade, preco_centavos: preco }).select('id').single()).id
}
const gramado = await saida('Gramado no inverno', 60, 20, 320000)
const maldivas = await saida('Maldivas lua de mel', 120, 4, 2100000)
const resBruno = ok(await dono.rpc('criar_reserva', { p_saida: gramado, p_cliente: id.Bruno, p_qtd: 2 }))
ok(await dono.rpc('registrar_pagamento', { p_reserva: resBruno, p_valor: 640000, p_tipo: 'saldo', p_forma: 'pix', p_data: data(0) })) // fully paid -> suggests Pago
const resDiego = ok(await dono.rpc('criar_reserva', { p_saida: maldivas, p_cliente: id.Diego, p_qtd: 2 }))
ok(await dono.rpc('registrar_pagamento', { p_reserva: resDiego, p_valor: 800000, p_tipo: 'sinal', p_forma: 'pix', p_data: data(0) })) // deposit -> suggests Reservado

console.log(`demo pronta: ${criados.length} clientes, ${negs.length} negociações, 2 reservas, meta de ${mesAtual}`)
