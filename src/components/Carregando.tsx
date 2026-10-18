// Row skeleton (R63): only shows after --atraso-esqueleto, so a fast load never flashes it.
export function Carregando({ altura }: { altura: string }) {
  return (
    <div aria-busy="true" aria-label="Carregando" className={`esqueleto flex flex-col gap-2 overflow-hidden ${altura}`}>
      <div className="esqueleto-barra h-10 w-2/3 rounded-lg bg-superficie-suave" />
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="esqueleto-barra h-(--linha-tabela) shrink-0 rounded-lg bg-superficie-suave" />)}
    </div>
  )
}
