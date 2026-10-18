import 'server-only'
import { headers } from 'next/headers'
import { urlDoSite } from './site'

// Base URL for links shown on screen (form, proposal). Production uses only NEXT_PUBLIC_SITE_URL (see urlDoSite).
export async function siteDaRequisicao(): Promise<string | null> {
  const h = await headers()
  const host = h.get('host')
  return urlDoSite(process.env, h.get('origin') ?? (host ? `${h.get('x-forwarded-proto') ?? 'http'}://${host}` : null))
}
