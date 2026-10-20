import { ClienteForm } from '@/components/clientes/ClienteForm'
import { VALORES_VAZIOS } from '@/lib/clientes/formulario'
import { salvarCliente } from '@/app/(app)/clientes/actions'

// Shared by the full page and the side window (R122). ?depois=negociacao returns to "Nova negociação" after saving (R123).
export async function ConteudoNovoCliente({ searchParams }: Pick<PageProps<'/clientes/novo'>, 'searchParams'>) {
  const depois = (await searchParams).depois === 'negociacao' ? 'negociacao' : undefined
  return <ClienteForm acao={salvarCliente.bind(null, null)} inicial={VALORES_VAZIOS} rotuloBotao="Salvar cliente" depois={depois} />
}
