'use client'

import { useRef, useState, useTransition } from 'react'
import { processarReservas, type EstadoReservas } from '@/app/(app)/importar/reservas/actions'

const botao = 'inline-flex min-h-12 items-center justify-center rounded-full px-6 font-semibold disabled:opacity-50'

// Same flow as the client import: check first, then import exactly what was checked.
export function FormImportarReservas() {
  const form = useRef<HTMLFormElement>(null)
  const [estado, setEstado] = useState<EstadoReservas>({})
  const [pendente, iniciar] = useTransition()
  const previa = estado.previa
  const podeImportar = Boolean(previa && previa.problemas.length === 0 && previa.prontas > 0 && !previa.jaImportado)

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const fd = new FormData(e.currentTarget)
    const acao = submitter?.value === 'importar' ? 'importar' : 'conferir'
    fd.set('acao', acao)
    if (acao === 'importar' && (fd.get('arquivo') as File | null)?.name !== previa?.arquivo) {
      setEstado({ erro: 'Esse arquivo ainda não foi conferido. Clique em "Conferir planilha" primeiro.' })
      return
    }
    iniciar(async () => {
      const resultado = await processarReservas({}, fd)
      setEstado(resultado)
      if (resultado.ok) form.current?.reset()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <form ref={form} onSubmit={enviar} className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4">
        <label htmlFor="arquivo-reservas" className="text-sm font-medium">Planilha de reservas (.xlsx ou .csv, até 4 MB)</label>
        <input id="arquivo-reservas" name="arquivo" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={() => setEstado({})} className="min-h-12 text-base" />
        <div className="flex flex-wrap gap-3">
          <button type="submit" name="acao" value="conferir" disabled={pendente} className={`${botao} bg-primaria-suave text-tinta`}>{pendente ? 'Aguarde…' : 'Conferir planilha'}</button>
          <button type="submit" name="acao" value="importar" disabled={pendente || !podeImportar} className={`${botao} bg-destaque text-destaque-texto`}>Importar</button>
        </div>
        {!podeImportar && <p className="text-sm text-tinta-suave">Confira a planilha primeiro; o botão Importar libera quando não houver linhas com problema.</p>}
      </form>

      {estado.erro && <p role="alert" className="rounded-xl bg-despesa-suave p-3 text-sm text-despesa">{estado.erro}</p>}
      {estado.ok && <p role="status" className="rounded-xl bg-receita-suave p-3 text-sm text-receita">{estado.ok}</p>}
      {estado.recusadas && estado.recusadas.length > 0 && (
        <ul aria-label="Linhas recusadas" className="flex flex-col gap-1 text-sm">
          {estado.recusadas.map((r) => <li key={r.linha}><strong>Linha {r.linha}:</strong> {r.mensagem}</li>)}
        </ul>
      )}

      {previa && (
        <section aria-labelledby="previa-reservas-titulo" className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4">
          <h2 id="previa-reservas-titulo" className="text-lg font-semibold">Conferência de {previa.arquivo}</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><dt className="text-tinta-suave">Linhas</dt><dd className="text-lg font-semibold">{previa.total}</dd></div>
            <div><dt className="text-tinta-suave">Prontas para importar</dt><dd className="text-lg font-semibold text-receita">{previa.prontas}</dd></div>
            <div><dt className="text-tinta-suave">Sem vagas (serão recusadas)</dt><dd className="text-lg font-semibold">{previa.semVagas.length}</dd></div>
            <div><dt className="text-tinta-suave">Com problema</dt><dd className={`text-lg font-semibold ${previa.problemas.length ? 'text-despesa' : ''}`}>{previa.problemas.length}</dd></div>
          </dl>
          {previa.jaImportado && <p role="alert" className="text-sm text-despesa">Este arquivo já foi importado antes.</p>}
          {previa.ignoradas.length > 0 && <p className="text-sm text-tinta-suave">Colunas ignoradas: {previa.ignoradas.join(', ')}.</p>}
          {previa.semVagas.length > 0 && <p className="text-sm">Linhas sem vaga na saída: {previa.semVagas.join(', ')}. As outras entram normalmente.</p>}
          {previa.problemas.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold text-despesa">Linhas com problema (corrija e confira de novo)</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {previa.problemas.map((p) => <li key={p.linha}><strong>Linha {p.linha}:</strong> {p.mensagem}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
