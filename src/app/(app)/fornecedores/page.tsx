import Link from 'next/link'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { FormFornecedor } from '@/components/custos/FormFornecedor'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { getMembro } from '@/lib/auth/agencia'
import { rotuloDoTipo } from '@/lib/custos/custos'
import { listarFornecedores } from '@/lib/custos/dados'
import { apagarFornecedor } from './actions'

export const metadata = { title: 'Fornecedores' }

async function Lista() {
  const [fornecedores, membro] = await Promise.all([listarFornecedores(), getMembro()])
  if (fornecedores.length === 0) return <p className="text-sm text-tinta-suave">Nenhum fornecedor ainda. Cadastre ônibus, hotéis, guias e quem mais entra nos custos das saídas.</p>
  return (
    <ul aria-label="Fornecedores" className="flex flex-col gap-2">
      {fornecedores.map((f) => (
        <li key={f.id} className="flex flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
          <p className="font-semibold">{f.nome} <span className="text-sm font-normal text-tinta-suave">· {rotuloDoTipo(f.tipo)}</span></p>
          {f.contato && <p className="text-sm">{f.contato}</p>}
          {membro?.papel === 'dono' && (
            <ConfirmarExclusao acao={apagarFornecedor.bind(null, f.id)} rotulo={`Apagar ${f.nome}`} rotuloConfirmar="Apagar mesmo"
              aviso="Apaga o fornecedor. Os custos já lançados continuam nas saídas, sem fornecedor." />
          )}
        </li>
      ))}
    </ul>
  )
}

export default function FornecedoresPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/passeios" className="w-fit text-sm text-primaria underline">← Passeios</Link>
      <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
      <FormFornecedor />
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Lista />
      </Suspense>
    </div>
  )
}
