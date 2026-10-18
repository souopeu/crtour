import Link from 'next/link'
import { itemAtivo, type GrupoMenu } from '@/lib/menu/menu'
import { IconeMenu } from './IconeMenu'

// Shared by the sidebar and the phone drawer. `recolhido` keeps only the icons; names stay available to screen readers.
export function ListaDeItens({ grupos, caminho, recolhido = false }: { grupos: GrupoMenu[]; caminho: string; recolhido?: boolean }) {
  return grupos.map((grupo, i) => (
    <div key={grupo.titulo ?? 'topo'} className={i > 0 ? 'mt-3 border-t border-linha pt-3' : ''}>
      {grupo.titulo ? (
        <p className={`px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-tinta-suave ${recolhido ? 'hidden' : ''}`}>{grupo.titulo}</p>
      ) : null}
      <ul className="flex flex-col gap-0.5">
        {grupo.itens.map((item) => {
          const ativo = itemAtivo(caminho, item)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-superficie-suave aria-[current=page]:bg-primaria-suave aria-[current=page]:font-semibold aria-[current=page]:text-primaria ${recolhido ? 'justify-center' : ''}`}
              >
                <IconeMenu nome={item.icone} />
                <span className={recolhido ? 'sr-only' : ''}>{item.rotulo}</span>
                {item.novos ? (
                  <span
                    aria-label={`${item.novos} novos`}
                    className={`rounded-full bg-destaque px-2 text-xs font-bold text-destaque-texto ${recolhido ? 'absolute right-1 top-1 px-1.5' : 'ml-auto'}`}
                  >
                    {item.novos}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  ))
}
