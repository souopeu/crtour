export function Carregando({ altura }: { altura: string }) {
  return (
    <div aria-busy="true" aria-label="Carregando" className={`esqueleto ${altura}`}>
      <div className="esqueleto-barra h-full rounded-[--radius-cartao] bg-superficie-suave" />
    </div>
  )
}
