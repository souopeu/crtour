import Link from 'next/link'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { FormExtra } from '@/components/extras/FormExtra'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { caixaTabela, rodapeTabela, tabelaPadrao } from '@/components/tela/estilos'
import { getMembro } from '@/lib/auth/agencia'
import { listarExtras, listarPasseiosParaExtra } from '@/lib/extras/dados'
import { COBRANCAS } from '@/lib/extras/extras'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { alternarExtra, salvarExtra } from './actions'

export const metadata = { title: 'Extras' }

async function Conteudo() {
  const [extras, passeios, membro] = await Promise.all([listarExtras(), listarPasseiosParaExtra(), getMembro()])
  const dono = membro?.papel === 'dono'
  return (
    <>
      <section aria-labelledby="novo-extra" className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4">
        <h2 id="novo-extra" className="font-semibold">Novo extra</h2>
        <FormExtra acao={salvarExtra.bind(null, null)} passeios={passeios} mostrarCusto={dono} rotuloBotao="Cadastrar extra"
          inicial={{ nome: '', preco: '', custo: '', cobranca: 'por_pessoa', todos: '1', passeios: '' }} />
      </section>
      {extras === null && <p role="alert" className="text-sm">Não foi possível carregar os extras. Tente de novo em instantes.</p>}
      {extras?.length === 0 && (
        <EstadoVazio compacto acoes={[{ href: '#novo-extra', rotulo: 'Cadastrar o primeiro extra' }]}>
          Nenhum extra ainda. Cadastre o que se vende junto com o passeio: almoço, fotos, kit, ingresso.
        </EstadoVazio>
      )}
      {extras && extras.length > 0 && (
        <div className={caixaTabela}>
          <table aria-label="Extras" className={tabelaPadrao}>
            <thead><tr><th>Extra</th><th>Preço</th>{dono && <th>Custo</th>}<th>Cobrança</th><th>Passeios</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {extras.map((e) => (
                <tr key={e.id} className={e.ativo ? '' : 'text-tinta-suave'}>
                  <td className="font-medium"><Link href={`/extras/${e.id}`} className="text-primaria underline-offset-2 hover:underline">{e.nome}</Link>{!e.ativo && ' (inativo)'}</td>
                  <td>{formatarReais(e.preco_centavos)}</td>
                  {dono && <td>{e.custo_centavos === null ? '—' : formatarReais(e.custo_centavos)}</td>}
                  <td>{COBRANCAS[e.cobranca]}</td>
                  <td>{e.todos_passeios ? 'Todos' : e.passeios.join(', ')}</td>
                  <td className="text-right">
                    <form action={alternarExtra.bind(null, e.id, !e.ativo)}>
                      <button type="submit" className="min-h-11 text-primaria underline">{e.ativo ? `Desativar ${e.nome}` : `Ativar ${e.nome}`}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className={rodapeTabela}><td colSpan={dono ? 6 : 5}>{extras.length} {extras.length === 1 ? 'extra' : 'extras'}</td></tr></tfoot>
          </table>
        </div>
      )}
    </>
  )
}

export default function ExtrasPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <CabecalhoPagina area="Catálogo" titulo="Extras" descricao="O que se vende junto com o passeio. Extra inativo sai da venda, mas fica nas reservas antigas." />
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Conteudo />
      </Suspense>
    </div>
  )
}
