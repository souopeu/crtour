import type { EstadoForm } from '@/app/(auth)/actions'

export function Mensagem({ estado }: { estado: EstadoForm }) {
  if (estado.erro) {
    return (
      <p role="alert" className="rounded-xl bg-despesa-suave p-3 text-sm text-despesa">
        {estado.erro}
      </p>
    )
  }
  if (estado.ok) {
    return (
      <p role="status" className="rounded-xl bg-receita-suave p-3 text-sm text-receita">
        {estado.ok}
      </p>
    )
  }
  return null
}
