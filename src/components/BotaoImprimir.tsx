'use client'

export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="min-h-12 rounded-full bg-destaque px-6 font-semibold text-destaque-texto print:hidden">
      Imprimir
    </button>
  )
}
