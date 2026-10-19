import type { MetadataRoute } from 'next'
import { APP_NAME } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'CRM para agências de turismo',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#f6f7fb',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icones/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icones/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icones/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
