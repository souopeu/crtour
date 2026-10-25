import { rotuloDoStatus, type StatusOperacional } from '@/lib/reservas/status'

// R136: colour helps, but the label is always written (colour is never the only cue).
export const COR_STATUS: Record<StatusOperacional, string> = {
  a_definir: 'bg-superficie-suave text-tinta',
  em_organizacao: 'bg-alerta-suave text-alerta',
  a_comunicar: 'bg-destaque text-destaque-texto',
  pronta: 'bg-receita-suave text-receita',
  em_execucao: 'bg-primaria-suave text-primaria',
}

export function ChipStatus({ status }: { status: StatusOperacional }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${COR_STATUS[status]}`}>{rotuloDoStatus(status)}</span>
}
