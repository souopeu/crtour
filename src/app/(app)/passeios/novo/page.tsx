import { PasseioForm } from '@/components/passeios/PasseioForm'
import { salvarPasseio } from '../actions'

export const metadata = { title: 'Novo passeio' }

export default function NovoPasseioPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-[1.75rem] font-medium tracking-tight">Novo passeio</h1>
      <PasseioForm acao={salvarPasseio.bind(null, null)} inicial={{ nome: '', destino: '', descricao: '', inclui: '', nao_inclui: '' }} rotuloBotao="Salvar passeio" />
    </div>
  )
}
