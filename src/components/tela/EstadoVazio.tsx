import Link from 'next/link'
import { botaoBarra } from './estilos'

type Acao = { href: string; rotulo: string }

// R63: an empty list says why it is empty and offers the action that fills it. The first action is the main one.
export function EstadoVazio({ children, acoes, compacto = false }: { children: React.ReactNode; acoes: Acao[]; compacto?: boolean }) {
  if (compacto) {
    return (
      <section aria-label="Lista vazia" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-tinta-suave">
        <p>{children}</p>
        {acoes.map((a) => <Link key={a.href} href={a.href} className="text-primaria underline">{a.rotulo}</Link>)}
      </section>
    )
  }
  return (
    <section aria-label="Lista vazia" className="flex flex-col items-start gap-3 rounded-(--radius-cartao) border border-dashed border-controle bg-superficie p-5">
      <p>{children}</p>
      {acoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          {acoes.map((a, i) => (
            <Link key={a.href} href={a.href} className={i === 0 ? botaoBarra : 'inline-flex min-h-10 items-center text-sm text-primaria underline'}>{a.rotulo}</Link>
          ))}
        </div>
      )}
    </section>
  )
}
