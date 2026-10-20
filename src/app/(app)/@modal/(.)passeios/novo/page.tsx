import { JanelaLateral } from '@/components/janela/JanelaLateral'
import { PasseioForm } from '@/components/passeios/PasseioForm'
import { salvarPasseio } from '@/app/(app)/passeios/actions'

export default function JanelaNovoPasseio() {
  return (
    <JanelaLateral titulo="Novo passeio">
      <PasseioForm acao={salvarPasseio.bind(null, null)} inicial={{ nome: '', destino: '', descricao: '', inclui: '', nao_inclui: '' }} rotuloBotao="Salvar passeio" />
    </JanelaLateral>
  )
}
