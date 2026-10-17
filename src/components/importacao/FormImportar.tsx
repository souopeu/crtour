'use client'

import { useRef, useState, useTransition } from 'react'
import { processarPlanilha, type EstadoImportacao } from '@/app/(app)/importar/actions'

const botao = 'inline-flex min-h-12 items-center justify-center rounded-full px-6 font-semibold disabled:opacity-50'

// Submitted manually (not via <form action>) so React does not clear the file input
// between "Conferir" and "Importar".
export function FormImportar() {
  const form = useRef<HTMLFormElement>(null)
  const [estado, setEstado] = useState<EstadoImportacao>({})
  const [pendente, iniciar] = useTransition()
  const previa = estado.previa
  const podeImportar = Boolean(previa && previa.totalErros === 0 && previa.novas > 0 && !previa.jaImportado)

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const fd = new FormData(e.currentTarget)
    const acao = submitter?.value === 'importar' ? 'importar' : 'conferir'
    fd.set('acao', acao)
    // Importing something other than what was just checked is refused (the server re-checks anyway).
    if (acao === 'importar' && (fd.get('arquivo') as File | null)?.name !== previa?.arquivo) {
      setEstado({ erro: 'Esse arquivo ainda não foi conferido. Clique em "Conferir planilha" primeiro.' })
      return
    }
    iniciar(async () => {
      const resultado = await processarPlanilha({}, fd)
      setEstado(resultado)
      if (resultado.ok) {
        form.current?.reset()
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <form ref={form} onSubmit={enviar} className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4">
        <label htmlFor="arquivo" className="text-sm font-medium">Planilha (.xlsx ou .csv, até 4 MB)</label>
        <input
          id="arquivo" name="arquivo" type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={() => setEstado({})} // a new file invalidates the old preview
          className="min-h-12 text-base"
        />
        <div className="flex flex-wrap gap-3">
          <button type="submit" name="acao" value="conferir" disabled={pendente} className={`${botao} bg-primaria-suave text-tinta`}>
            {pendente ? 'Aguarde…' : 'Conferir planilha'}
          </button>
          <button type="submit" name="acao" value="importar" disabled={pendente || !podeImportar} className={`${botao} bg-destaque text-destaque-texto`}>
            Importar
          </button>
        </div>
        {!podeImportar && <p className="text-sm text-tinta-suave">Confira a planilha primeiro; o botão Importar libera quando não houver erros.</p>}
      </form>

      {estado.erro && <p role="alert" className="rounded-xl bg-despesa-suave p-3 text-sm text-despesa">{estado.erro}</p>}
      {estado.ok && <p role="status" className="rounded-xl bg-receita-suave p-3 text-sm text-receita">{estado.ok}</p>}

      {previa && (
        <section aria-labelledby="previa-titulo" className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4">
          <h2 id="previa-titulo" className="text-lg font-semibold">Conferência de {previa.arquivo}</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <div><dt className="text-tinta-suave">Linhas</dt><dd className="text-lg font-semibold">{previa.total}</dd></div>
            <div><dt className="text-tinta-suave">Novos clientes</dt><dd className="text-lg font-semibold text-receita">{previa.novas}</dd></div>
            <div><dt className="text-tinta-suave">Já cadastrados</dt><dd className="text-lg font-semibold">{previa.jaCadastradas}</dd></div>
            <div><dt className="text-tinta-suave">Repetidos na planilha</dt><dd className="text-lg font-semibold">{previa.repetidas}</dd></div>
            <div><dt className="text-tinta-suave">Com erro</dt><dd className={`text-lg font-semibold ${previa.totalErros ? 'text-despesa' : ''}`}>{previa.totalErros}</dd></div>
          </dl>
          {previa.jaImportado && <p role="alert" className="text-sm text-despesa">Este arquivo já foi importado antes.</p>}
          {previa.colunasIgnoradas.length > 0 && (
            <p className="text-sm text-tinta-suave">Colunas ignoradas: {previa.colunasIgnoradas.join(', ')}.</p>
          )}
          {previa.amostra.length > 0 && <p className="text-sm text-tinta-suave">Exemplos de novos clientes: {previa.amostra.join(', ')}.</p>}
          {previa.erros.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold text-despesa">Linhas com erro (corrija na planilha e confira de novo)</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {previa.erros.map((er) => (
                  <li key={er.linha}><strong>Linha {er.linha}:</strong> {er.mensagens.join(' ')}</li>
                ))}
              </ul>
              {previa.totalErros > previa.erros.length && (
                <p className="mt-1 text-sm text-tinta-suave">E mais {previa.totalErros - previa.erros.length} linhas com erro.</p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
