import { APP_NAME } from '@/lib/brand'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
    </main>
  )
}
