import { APP_NAME } from '@/lib/brand'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#1d4ed8] px-4 py-10">
      <p className="text-4xl font-extrabold tracking-tight text-destaque">{APP_NAME}</p>
      <div className="w-full max-w-sm rounded-[--radius-cartao] border border-linha bg-superficie p-6 text-tinta">{children}</div>
    </main>
  )
}
