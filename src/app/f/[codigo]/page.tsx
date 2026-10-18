import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { FormPublico } from '@/components/formulario/FormPublico'
import { Carregando } from '@/components/Carregando'
import { criarClientePublico } from '@/lib/supabase/publico'

export const metadata: Metadata = { title: 'Fale com a agência', robots: { index: false, follow: false } }

const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v.slice(0, 100) : '')

async function Conteudo({ params, searchParams }: PageProps<'/f/[codigo]'>) {
  const [{ codigo }, sp] = await Promise.all([params, searchParams])
  if (!/^[A-Za-z0-9_-]{24}$/.test(codigo)) notFound()
  const { data } = await criarClientePublico().rpc('formulario_publico', { p_codigo: codigo })
  const form = (data as { agencia: string; titulo: string; texto: string }[] | null)?.[0]
  if (!form) notFound() // off or unknown: same answer, reveals nothing
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wide text-primaria">{form.agencia}</p>
      <h1 className="text-2xl font-bold tracking-tight">{form.titulo}</h1>
      {form.texto && <p className="whitespace-pre-line text-tinta-suave">{form.texto}</p>}
      <FormPublico codigo={codigo} origem={{ o: um(sp.o), utm_source: um(sp.utm_source), utm_campaign: um(sp.utm_campaign) }} />
    </>
  )
}

// R65: public page, no app menu, nothing but the agency's own texts.
export default function FormularioPublicoPage(props: PageProps<'/f/[codigo]'>) {
  return (
    <main className="flex min-h-screen justify-center bg-superficie-suave px-4 py-10">
      <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-(--radius-cartao) border border-linha bg-superficie p-6">
        <Suspense fallback={<Carregando altura="h-64" />}>
          <Conteudo {...props} />
        </Suspense>
      </div>
    </main>
  )
}
