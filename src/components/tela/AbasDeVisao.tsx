import Link from 'next/link'

export type Aba = { rotulo: string; href: string; ativa: boolean }

// R60: the views of a screen, as underlined tabs. Each href already carries the screen's filters.
export function AbasDeVisao({ rotulo, abas }: { rotulo: string; abas: Aba[] }) {
  return (
    <nav aria-label={rotulo} className="flex gap-1 border-b border-linha">
      {abas.map((a) => (
        <Link
          key={a.rotulo}
          href={a.href}
          aria-current={a.ativa ? 'page' : undefined}
          className="-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm text-tinta-suave hover:text-tinta aria-[current=page]:border-primaria aria-[current=page]:font-semibold aria-[current=page]:text-tinta"
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  )
}
