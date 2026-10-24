import { Suspense } from 'react'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { Carregando } from '@/components/Carregando'
import { FormFornecedor } from '@/components/custos/FormFornecedor'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { getMembro } from '@/lib/auth/agencia'
import { rotuloDoTipo } from '@/lib/custos/custos'
import { listarFornecedores } from '@/lib/custos/dados'
import { apagarFornecedor } from './actions'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { caixaTabela, rodapeTabela, tabelaPadrao } from '@/components/tela/estilos'

export const metadata = { title: 'Fornecedores' }

async function Lista() {
  const [fornecedores, membro] = await Promise.all([listarFornecedores(), getMembro()])
  if (fornecedores.length === 0) {
    return <EstadoVazio compacto acoes={[{ href: '#novo-fornecedor', rotulo: 'Cadastrar o primeiro fornecedor' }]}>Nenhum fornecedor ainda. Cadastre ônibus, hotéis, guias e quem mais entra nos custos das saídas.</EstadoVazio>
  }
  // R119: table in the monday pattern (coloured left edge, rows at --linha-tabela, total in the footer)
  return (
    <div className={caixaTabela}>
      <table aria-label="Fornecedores" className={tabelaPadrao}>
        <thead><tr><th>Fornecedor</th><th>Tipo</th><th>Contato</th>{membro?.papel === 'dono' && <th className="sr-only">Ações</th>}</tr></thead>
        <tbody>
          {fornecedores.map((f) => (
            <tr key={f.id}>
              <td className="font-medium">{f.nome}</td>
              <td><span className="rounded-md bg-superficie-suave px-2 py-0.5">{rotuloDoTipo(f.tipo)}</span></td>
              <td>{f.contato ?? '—'}</td>
              {membro?.papel === 'dono' && (
                <td className="text-right">
                  <ConfirmarExclusao acao={apagarFornecedor.bind(null, f.id)} rotulo={`Apagar ${f.nome}`} rotuloConfirmar="Apagar mesmo"
                    aviso="Apaga o fornecedor. Os custos já lançados continuam nas saídas, sem fornecedor." />
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot><tr className={rodapeTabela}><td colSpan={membro?.papel === 'dono' ? 4 : 3}>{fornecedores.length} {fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}</td></tr></tfoot>
      </table>
    </div>
  )
}

export default function FornecedoresPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <CabecalhoPagina area="Catálogo" titulo="Fornecedores" descricao="Transporte, hospedagem, guias e quem mais entra nos custos das saídas." />
      <FormFornecedor />
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Lista />
      </Suspense>
    </div>
  )
}
