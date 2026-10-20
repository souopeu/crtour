import Form from 'next/form'
import Link from 'next/link'
import { NegociacaoForm } from '@/components/negociacoes/NegociacaoForm'
import { buscarClientesParaReserva, buscarNomeDoCliente } from '@/lib/passeios/dados'
import { listarMembros, listarSaidasParaSelecao } from '@/lib/negociacoes/dados'
import { criarNegociacao } from '@/app/(app)/negociacoes/actions'

const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

// Shared by the full page and the side window (R122). next/form keeps the search inside the window.
export async function ConteudoNovaNegociacao({ searchParams }: Pick<PageProps<'/negociacoes/novo'>, 'searchParams'>) {
  const sp = await searchParams
  const clienteId = um(sp.cliente)
  const nomeEscolhido = clienteId ? await buscarNomeDoCliente(clienteId) : null

  if (nomeEscolhido) {
    const [responsaveis, saidas] = await Promise.all([listarMembros(), listarSaidasParaSelecao()])
    return (
      <>
        <p className="mb-4">Negociação para <strong>{nomeEscolhido}</strong>. <Link href="/negociacoes/novo" className="text-primaria underline">Escolher outro cliente</Link> · <Link href="/clientes/novo?depois=negociacao" className="text-primaria underline">+ Novo cliente</Link></p>
        <NegociacaoForm
          acao={criarNegociacao.bind(null, clienteId)}
          inicial={{ titulo: '', valor: '', etapa: 'interessado', probabilidade: '', responsavel: '', dataEsperada: '', saida: '', motivo: '', motivoTexto: '' }}
          rotuloBotao="Criar negociação"
          responsaveis={responsaveis}
          saidas={saidas}
          faixaEtapas
        />
      </>
    )
  }

  const busca = um(sp.busca).trim().slice(0, 100)
  const resultados = busca ? await buscarClientesParaReserva(busca) : []
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <Form action="/negociacoes/novo" role="search" className="flex flex-col gap-2">
        <label htmlFor="busca" className="text-sm font-medium">Para qual cliente? (nome, e-mail ou telefone)</label>
        <div className="flex gap-2">
          <input id="busca" name="busca" type="search" defaultValue={busca} maxLength={100} className="h-12 min-w-0 flex-1 rounded-xl border border-controle bg-superficie px-3 text-base" />
          <button type="submit" className="min-h-12 rounded-full bg-destaque px-6 font-semibold text-destaque-texto">Buscar</button>
        </div>
      </Form>
      <Link href="/clientes/novo?depois=negociacao" className="w-fit text-sm text-primaria underline">+ Novo cliente</Link>
      {busca && resultados.length === 0 && <p className="text-sm text-tinta-suave">Nenhum cliente encontrado. <Link href="/clientes/novo?depois=negociacao" className="text-primaria underline">Cadastrar novo cliente</Link></p>}
      {resultados.length > 0 && (
        <ul className="flex flex-col gap-2">
          {resultados.map((c) => (
            <li key={c.id}>
              <Link href={`/negociacoes/novo?cliente=${c.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
                <span className="font-semibold">{c.nome}</span>
                <span className="text-sm text-tinta-suave">{c.cidade ?? ''} · Escolher</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
