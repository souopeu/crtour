type Props = {
  nome: string
  id?: string
  rotulo: string
  tipo?: string
  valor?: string
  erros?: string[]
  autoComplete?: string
  dica?: string
}

export function Campo({ nome, id = nome, rotulo, tipo = 'text', valor, erros, autoComplete, dica }: Props) {
  const idErro = `${id}-erro`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <input
        id={id}
        name={nome}
        type={tipo}
        defaultValue={valor}
        autoComplete={autoComplete}
        aria-invalid={erros?.length ? true : undefined}
        aria-describedby={erros?.length ? idErro : undefined}
        className="h-12 rounded-xl border border-controle bg-superficie px-3 text-base"
      />
      {dica && !erros?.length && <p className="text-sm text-tinta-suave">{dica}</p>}
      {erros?.length ? (
        <p id={idErro} role="alert" className="text-sm text-despesa">
          {erros[0]}
        </p>
      ) : null}
    </div>
  )
}
