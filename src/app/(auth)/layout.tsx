import { IconeAuth } from '@/components/auth/IconesAuth'
import { APP_NAME } from '@/lib/brand'

// Own copy: what crTOUR does for an agency (no text, logo or colour taken from other products).
const BENEFICIOS = [
  'Funil de vendas e remarketing',
  'Reservas, saídas e embarque',
  'Cobranças e comissões',
  'WhatsApp e campanhas',
  'Lembretes no celular',
  'Cada pessoa com seu acesso',
] as const

function Marca() {
  return (
    <p className="flex items-center gap-2 text-3xl font-extrabold tracking-tight" aria-label={APP_NAME}>
      <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-xl bg-marca text-destaque"><IconeAuth nome="pino" className="size-6" /></span>
      <span aria-hidden="true"><span className="text-marca">cr</span><span className="text-tinta">TOUR</span></span>
    </p>
  )
}

// Showcase on wide screens; phones go straight to the form.
function Vitrine() {
  return (
    <section aria-label={`Sobre o ${APP_NAME}`} className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-linear-to-br from-vitrine to-vitrine-2 p-10 text-vitrine-texto lg:flex xl:p-14">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-marca/40 blur-3xl" />
      <div className="relative flex flex-col gap-8">
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-vitrine-suave/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-vitrine-suave">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-destaque" />CRM para agências de turismo
        </p>
        <h2 className="max-w-xl text-5xl font-extrabold leading-[1.05] tracking-tight xl:text-6xl">
          Cada cliente lembrado.<br /><span className="text-destaque">Cada viagem no lugar certo.</span>
        </h2>
        <p className="max-w-lg text-lg text-vitrine-suave">Clientes, funil, reservas, saídas e cobranças da sua agência no mesmo painel, do escritório ou do celular.</p>
        <ul className="grid max-w-2xl gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {BENEFICIOS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm"><IconeAuth nome="certo" className="mt-0.5 size-5 text-destaque" />{b}</li>
          ))}
        </ul>
      </div>
      <p className="relative flex items-center gap-2 text-sm text-vitrine-suave"><IconeAuth nome="escudo" className="size-5" />Os dados de cada agência ficam só com ela.</p>
    </section>
  )
}

// Same frame for sign-in, sign-up and the password pages: showcase on the left, the form on the right.
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="min-h-screen bg-papel lg:bg-vitrine lg:p-6">
      <div className="mx-auto grid min-h-screen max-w-[90rem] overflow-hidden lg:min-h-[calc(100vh-3rem)] lg:grid-cols-2 lg:rounded-3xl">
        <Vitrine />
        <div className="flex flex-col justify-center bg-papel px-5 py-10 sm:px-10 lg:px-16">
          <div className="mx-auto flex w-full max-w-md flex-col gap-8">
            <Marca />
            <div className="text-tinta">{children}</div>
            <p className="text-center text-xs text-tinta-suave">© {APP_NAME} · CRM para agências de turismo</p>
          </div>
        </div>
      </div>
    </main>
  )
}
