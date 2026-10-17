import Link from 'next/link'
import { temPendencias, VERSAO_TEXTO } from '@/lib/legal/dados'

export function Documento({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-prose px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">{titulo}</h1>
      <p className="mt-1 text-sm text-tinta-suave">Versão de {VERSAO_TEXTO}</p>
      {temPendencias() && (
        <p role="note" className="mt-4 rounded-xl bg-alerta-suave p-3 text-sm text-alerta">
          Rascunho pendente de revisão jurídica. Os trechos entre colchetes ainda precisam ser preenchidos.
        </p>
      )}
      <div className="mt-6 flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
      <p className="mt-8 text-sm">
        <Link href="/login" className="text-primaria underline">Voltar</Link>
      </p>
    </main>
  )
}
