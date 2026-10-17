import { ClienteForm } from '@/components/clientes/ClienteForm'
import { VALORES_VAZIOS } from '@/lib/clientes/formulario'
import { salvarCliente } from '../actions'

export const metadata = { title: 'Novo cliente' }

export default function NovoClientePage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Novo cliente</h1>
      <ClienteForm acao={salvarCliente.bind(null, null)} inicial={VALORES_VAZIOS} rotuloBotao="Salvar cliente" />
    </>
  )
}
