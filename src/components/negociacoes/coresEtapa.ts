import type { Etapa } from '@/lib/negociacoes/negociacoes'

// Static class names (Tailwind must see them whole). Colours come from the --etapa-* tokens; text always says the stage.
export const COR_ETAPA: Record<Etapa, { fundo: string; borda: string }> = {
  interessado: { fundo: 'bg-etapa-interessado', borda: 'border-l-etapa-interessado-borda' },
  orcamento: { fundo: 'bg-etapa-orcamento', borda: 'border-l-etapa-orcamento-borda' },
  reservado: { fundo: 'bg-etapa-reservado', borda: 'border-l-etapa-reservado-borda' },
  pago: { fundo: 'bg-etapa-pago', borda: 'border-l-etapa-pago-borda' },
  viajou: { fundo: 'bg-etapa-viajou', borda: 'border-l-etapa-viajou-borda' },
  pos_venda: { fundo: 'bg-etapa-pos-venda', borda: 'border-l-etapa-pos-venda-borda' },
  perdido: { fundo: 'bg-etapa-perdido', borda: 'border-l-etapa-perdido-borda' },
}

export const blocoEtapa = (etapa: Etapa) => `inline-block min-w-24 rounded-md px-2 py-1 text-center text-xs font-semibold text-etapa-texto ${COR_ETAPA[etapa].fundo}`
