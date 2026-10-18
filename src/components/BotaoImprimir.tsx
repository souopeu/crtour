'use client'

export function BotaoImprimir({ rotulo = 'Imprimir' }: { rotulo?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="min-h-12 rounded-full bg-destaque px-6 font-semibold text-destaque-texto print:hidden">
      {rotulo}
    </button>
  )
}
