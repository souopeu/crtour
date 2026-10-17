import { APP_NAME } from '@/lib/brand'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1d4ed8] px-4">
      <h1 className="text-3xl font-extrabold tracking-tight text-destaque">{APP_NAME}</h1>
    </main>
  )
}
