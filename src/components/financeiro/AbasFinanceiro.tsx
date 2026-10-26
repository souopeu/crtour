import { Suspense } from 'react'
import { AbasDeVisao } from '@/components/tela/AbasDeVisao'
import { getMembro } from '@/lib/auth/agencia'
import { abasFinanceiro } from '@/lib/financeiro/abas'

async function Abas({ caminho }: { caminho: string }) {
  const membro = await getMembro()
  if (!membro) return null
  return <AbasDeVisao rotulo="Seções do financeiro" abas={abasFinanceiro(membro.papel, caminho)} />
}

// R143: the same tabs on every Financeiro screen; each one only shows the tabs that person may open (R144).
export function AbasFinanceiro({ caminho }: { caminho: string }) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-11 border-b border-linha" />}>
      <Abas caminho={caminho} />
    </Suspense>
  )
}
