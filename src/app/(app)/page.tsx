import Link from 'next/link'

export default function Home() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
      <p className="mt-2 text-tinta-suave">Em breve: sua lista de clientes aparece aqui.</p>
      <Link href="/clientes/novo" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-destaque px-6 font-semibold text-destaque-texto">
        Novo cliente
      </Link>
    </section>
  )
}
