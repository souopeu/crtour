import { headers } from 'next/headers'
import { Suspense } from 'react'
import { FormExcluirConta } from '@/components/FormExcluirConta'
import { FormLimites } from '@/components/FormLimites'
import { Equipe } from '@/components/equipe/Equipe'
import { SecaoComissao } from '@/components/comissao/SecaoComissao'
import { FormMensagensPasseio } from '@/components/mensagens/FormMensagensPasseio'
import { buscarConfigMensagens } from '@/lib/mensagens/dados'
import { getMembro } from '@/lib/auth/agencia'
import { buscarLimites } from '@/lib/hoje/dados'
import { Carregando } from '@/components/Carregando'
import { CampoCopiar } from '@/components/formulario/CampoCopiar'
import { FormFormularioCaptacao } from '@/components/formulario/FormFormularioCaptacao'
import { QrCode } from '@/components/formulario/QrCode'
import { urlDoSite } from '@/lib/auth/site'
import { buscarFormulario } from '@/lib/formulario/dados'
import { linkDoFormulario } from '@/lib/formulario/formulario'

export const metadata = { title: 'Configurações' }

async function ExcluirConta() {
  const membro = await getMembro()
  if (membro?.papel !== 'dono') {
    return <p className="text-sm text-tinta-suave">Só o dono da agência pode excluir a conta.</p>
  }
  return (
    <>
      <p className="max-w-prose text-sm text-despesa">
        Apaga a agência, todos os clientes, etiquetas, anotações e importações, e remove o acesso de todos os usuários.
        Não dá para voltar atrás. Baixe seus dados antes.
      </p>
      <FormExcluirConta />
    </>
  )
}

async function Prazos() {
  const [membro, limites] = await Promise.all([getMembro(), buscarLimites()])
  if (membro?.papel !== 'dono') {
    return <p className="text-sm text-tinta-suave">Cliente sem contato depois de {limites.dias_sem_contato} dias; negociação parada depois de {limites.dias_negociacao_parada} dias. Só o dono muda estes prazos.</p>
  }
  return <FormLimites diasSemContato={limites.dias_sem_contato} diasParada={limites.dias_negociacao_parada} />
}

const link = 'inline-flex min-h-11 items-center text-primaria underline'

async function MensagensPasseio() {
  const [membro, c] = await Promise.all([getMembro(), buscarConfigMensagens()])
  if (membro?.papel !== 'dono') return <p className="text-sm text-tinta-suave">Lembrete {c.dias_lembrete} {c.dias_lembrete === 1 ? 'dia' : 'dias'} antes da saída; avaliação {c.dias_avaliacao} {c.dias_avaliacao === 1 ? 'dia' : 'dias'} depois. Só o dono muda as mensagens.</p>
  return <FormMensagensPasseio inicial={{
    diasLembrete: String(c.dias_lembrete), diasAvaliacao: String(c.dias_avaliacao),
    confirmacao: c.modelo_confirmacao ?? '', lembrete: c.modelo_lembrete ?? '', avaliacao: c.modelo_avaliacao ?? '',
  }} />
}

async function Comissao() {
  const membro = await getMembro()
  return membro ? <SecaoComissao membro={membro} /> : null
}

async function SecaoEquipe() {
  const membro = await getMembro()
  return membro ? <Equipe membro={membro} /> : null
}

// R41: only the owner exports the agency's data.
async function Exportar() {
  const membro = await getMembro()
  if (membro?.papel !== 'dono') return <p className="text-sm text-tinta-suave">Só o dono da agência baixa os dados.</p>
  return (
    <>
      <p className="max-w-prose text-sm text-tinta-suave">
        Baixe tudo em planilha (CSV): clientes, anotações, reservas, pagamentos e acompanhantes. O arquivo de clientes pode ser importado de volta.
      </p>
      <a href="/exportar?tipo=clientes" className={link}>Baixar clientes (.csv)</a>
      <a href="/exportar?tipo=anotacoes" className={link}>Baixar anotações (.csv)</a>
      <a href="/exportar?tipo=reservas" className={link}>Baixar reservas (.csv)</a>
      <a href="/exportar?tipo=pagamentos" className={link}>Baixar pagamentos (.csv)</a>
      <a href="/exportar?tipo=acompanhantes" className={link}>Baixar acompanhantes (.csv)</a>
    </>
  )
}

// R65: public lead form. The owner edits it; everyone sees the links while it is on.
async function FormularioCaptacao() {
  const [membro, form, h] = await Promise.all([getMembro(), buscarFormulario(), headers()])
  const site = urlDoSite(process.env, h.get('origin') ?? (h.get('host') ? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}` : null))
  const ehDono = membro?.papel === 'dono'
  return (
    <>
      <p className="max-w-prose text-sm text-tinta-suave">
        Um link público para a bio do Instagram, anúncios ou o WhatsApp. Quem preencher vira cliente e uma negociação em Interessado, e você recebe um aviso.
      </p>
      {ehDono
        ? <FormFormularioCaptacao inicial={{ titulo: form?.titulo ?? 'Fale com a gente', texto: form?.texto ?? 'Conte para onde quer viajar e a agência entra em contato pelo WhatsApp.', ativo: form?.ativo ?? false }} />
        : !form?.ativo && <p className="text-sm text-tinta-suave">O formulário está desligado. Só o dono liga.</p>}
      {form && site && (ehDono || form.ativo) && (
        <div className="flex flex-col gap-3 border-t border-linha pt-3">
          {!form.ativo && <p className="text-sm font-medium text-alerta">Desligado: os links abaixo não funcionam até você ligar o formulário.</p>}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex flex-1 flex-col gap-3">
              <CampoCopiar id="link-form" rotulo="Link do formulário" valor={linkDoFormulario(site, form.codigo, null)} />
              <CampoCopiar id="link-instagram" rotulo="Link para a bio do Instagram" valor={linkDoFormulario(site, form.codigo, 'instagram')} />
              <CampoCopiar id="link-anuncio" rotulo="Link para anúncios" valor={linkDoFormulario(site, form.codigo, 'anuncio')} />
            </div>
            <QrCode texto={linkDoFormulario(site, form.codigo, null)} rotulo="QR code do link do formulário" />
          </div>
        </div>
      )}
    </>
  )
}

const SECOES = [
  { id: 'prazos-titulo', titulo: 'Prazos da tela Hoje', Conteudo: Prazos },
  { id: 'formulario-titulo', titulo: 'Formulário de captação', Conteudo: FormularioCaptacao },
  { id: 'equipe-titulo', titulo: 'Equipe', Conteudo: SecaoEquipe },
  { id: 'mensagens-passeio-titulo', titulo: 'Mensagens do passeio', Conteudo: MensagensPasseio },
  { id: 'comissao-titulo', titulo: 'Comissão', Conteudo: Comissao },
  { id: 'exportar-titulo', titulo: 'Exportar seus dados', Conteudo: Exportar },
  { id: 'excluir-titulo', titulo: 'Excluir conta', Conteudo: ExcluirConta },
]

// E5-4: one card per setting, with an in-page index beside them on wide screens.
export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Nesta página" className="lg:sticky lg:top-4 lg:self-start">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:flex-col">
            {SECOES.map((x) => (
              <li key={x.id}><a href={`#${x.id}`} className="inline-flex min-h-11 items-center text-sm text-tinta-suave hover:text-primaria hover:underline">{x.titulo}</a></li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-4">
          {SECOES.map(({ id, titulo, Conteudo }) => (
            <section key={id} aria-labelledby={id} className={`flex scroll-mt-4 flex-col gap-3 rounded-(--radius-cartao) border border-linha bg-superficie p-5 ${id === 'excluir-titulo' ? 'border-l-4 border-l-despesa' : ''}`}>
              <h2 id={id} className="text-lg font-semibold">{titulo}</h2>
              <Suspense fallback={<Carregando altura="h-24" />}>
                <Conteudo />
              </Suspense>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
