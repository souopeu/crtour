import { excluirPergunta, criarPergunta, editarPergunta, subirPergunta } from '@/app/(app)/passeios/actions'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { perguntasDoPasseio } from '@/lib/perguntas/dados'
import { MAX_PERGUNTAS, TIPOS_PERGUNTA } from '@/lib/perguntas/perguntas'
import { EditarPergunta, NovaPergunta } from './FormsPergunta'

// R160: what the agency needs to know before the tour, answered when selling or later on the reservation.
export async function PerguntasDoPasseio({ passeioId }: { passeioId: string }) {
  const perguntas = await perguntasDoPasseio(passeioId)
  return (
    <section aria-labelledby="perguntas-titulo" className="flex flex-col gap-4">
      <div>
        <h2 id="perguntas-titulo" className="text-lg font-semibold">Perguntas antes do passeio</h2>
        <p className="text-sm text-tinta-suave">Aparecem na venda e na reserva. Obrigatória sem resposta não impede a venda: a reserva mostra o que falta.</p>
      </div>
      {perguntas.length > 0 && (
        <ol className="flex flex-col gap-3">
          {perguntas.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
              <p className="text-sm text-tinta-suave">
                {i + 1}. {TIPOS_PERGUNTA[p.tipo]}{p.opcoes && `: ${p.opcoes.join(', ')}`} · {p.por_passageiro ? 'por passageiro' : 'por reserva'}
              </p>
              <EditarPergunta acao={editarPergunta.bind(null, passeioId, p.id)} texto={p.texto} obrigatoria={p.obrigatoria} rotulo={String(i + 1)} />
              <div className="flex flex-wrap gap-4">
                {i > 0 && (
                  <form action={subirPergunta.bind(null, passeioId, p.id)}>
                    <button type="submit" className="min-h-11 text-sm text-primaria underline">Subir<span className="sr-only"> a pergunta {p.texto}</span></button>
                  </form>
                )}
                <ConfirmarExclusao acao={excluirPergunta.bind(null, passeioId, p.id)} rotulo={`Excluir a pergunta ${i + 1}`} rotuloConfirmar="Excluir mesmo" rotuloVoltar="Voltar"
                  aviso="Exclui a pergunta deste passeio. As respostas já dadas continuam nas reservas." />
              </div>
            </li>
          ))}
        </ol>
      )}
      {perguntas.length < MAX_PERGUNTAS
        ? <NovaPergunta acao={criarPergunta.bind(null, passeioId)} />
        : <p className="text-sm text-tinta-suave">Este passeio já tem {MAX_PERGUNTAS} perguntas, o máximo.</p>}
    </section>
  )
}
