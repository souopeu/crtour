'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { buscarGlobal } from '@/app/(app)/busca/actions'
import {
  agrupar, atalhoAbreBusca, hrefResultado, hrefVerTodos, termoValido, type ResultadoBusca,
} from '@/lib/busca/busca'
import { formatarWhatsapp } from '@/lib/clientes/rotulos'
import { formatarDataBr } from '@/lib/formato'

const ESPERA_MS = 200

function detalheDe(r: ResultadoBusca): string {
  if (r.tipo === 'passeio') {
    const proxima = r.data ? `próxima saída ${formatarDataBr(r.data)}` : 'sem saída aberta'
    return r.detalhe ? `${r.detalhe} · ${proxima}` : proxima
  }
  if (r.tipo === 'cliente' && r.detalhe && /^\d+$/.test(r.detalhe)) return formatarWhatsapp(r.detalhe)
  return r.detalhe ?? ''
}

// Global search (R76): a combobox in the top bar, opened by "/" from any screen.
export function BuscaGlobal({ className = '' }: { className?: string }) {
  const id = useId()
  const router = useRouter()
  const campo = useRef<HTMLInputElement>(null)
  const pedido = useRef(0)
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>([])
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(-1)
  const valido = termoValido(termo)

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const el = campo.current
      // Two copies exist (top bar and phone header); only the visible one answers.
      if (!el || el.offsetParent === null) return
      if (!atalhoAbreBusca(e, document.activeElement as HTMLElement | null)) return
      e.preventDefault()
      el.focus()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [])

  useEffect(() => {
    const meu = ++pedido.current
    if (!valido) return
    const espera = setTimeout(async () => {
      const r = await buscarGlobal(valido)
      if (meu !== pedido.current) return // a newer term was typed meanwhile
      setResultados(r)
      setAtivo(-1)
    }, ESPERA_MS)
    return () => clearTimeout(espera)
  }, [valido])

  const lista = valido ? resultados ?? [] : []
  const grupos = agrupar(lista)
  const plano = grupos.flatMap((g) => g.itens) // keyboard order = visual order
  const mostrar = aberto && valido !== null
  const opcaoId = (i: number) => `${id}-opcao-${i}`
  const status = !valido ? '' : resultados === null ? 'Não foi possível buscar agora. Tente de novo.'
    : lista.length === 0 ? 'Nada encontrado.' : `${lista.length} ${lista.length === 1 ? 'resultado' : 'resultados'}.`

  function fechar() {
    setAberto(false)
    setAtivo(-1)
  }

  function ir(href: string) {
    fechar()
    setTermo('')
    campo.current?.blur() // so the next "/" opens the search again instead of typing into it
    router.push(href)
  }

  function aoTeclarNoCampo(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { fechar(); return }
    if (!plano.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setAtivo((a) => (a + 1) % plano.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => (a <= 0 ? plano.length - 1 : a - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); ir(hrefResultado(plano[Math.max(ativo, 0)])) }
  }

  return (
    // Closes only when focus leaves the whole widget, so Tab can still reach the "see all" links.
    <div className={`relative ${className}`} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) fechar() }}>
      <input
        ref={campo}
        type="search"
        role="combobox"
        aria-label="Buscar no crTOUR"
        aria-expanded={mostrar}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={mostrar && ativo >= 0 ? opcaoId(ativo) : undefined}
        placeholder="Buscar (atalho /)"
        maxLength={100}
        autoComplete="off"
        value={termo}
        onChange={(e) => { setTermo(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclarNoCampo}
        className="h-10 w-full rounded-lg border border-controle bg-superficie px-3 text-sm text-tinta"
      />
      <p role="status" className="sr-only">{mostrar ? status : ''}</p>
      {mostrar && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-[70dvh] overflow-y-auto rounded-(--radius-cartao) border border-linha bg-superficie p-1 text-tinta shadow-lg">
          {plano.length === 0 && <p className="px-3 py-2 text-sm text-tinta-suave">{status}</p>}
          <div id={`${id}-lista`} role="listbox" aria-label="Resultados da busca">
            {grupos.map((g) => (
              <div key={g.tipo} role="group" aria-label={g.rotulo}>
                <div aria-hidden="true" className="px-3 pt-2 pb-1 text-xs font-medium text-tinta-suave">{g.rotulo}</div>
                {g.itens.map((r) => {
                  const i = plano.indexOf(r)
                  return (
                    <div
                      key={r.id}
                      id={opcaoId(i)}
                      role="option"
                      aria-selected={i === ativo}
                      onMouseDown={(e) => { e.preventDefault(); ir(hrefResultado(r)) }}
                      onMouseEnter={() => setAtivo(i)}
                      className={`flex min-h-11 cursor-pointer flex-col justify-center rounded-lg px-3 py-1 ${i === ativo ? 'bg-primaria-suave' : ''}`}
                    >
                      <span className="font-medium">{r.titulo}</span>
                      {detalheDe(r) && <span className="text-xs text-tinta-suave">{detalheDe(r)}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {grupos.map((g) => {
            const href = hrefVerTodos(g.tipo, valido ?? '')
            return href && (
              <Link key={g.tipo} href={href} onClick={() => { fechar(); setTermo('') }}
                className="block px-3 py-2 text-sm text-primaria underline-offset-2 hover:underline">
                Ver todos em {g.rotulo}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
