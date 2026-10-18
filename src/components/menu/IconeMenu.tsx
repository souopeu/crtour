import type { IconeMenu as Nome } from '@/lib/menu/menu'

// Own simple outline icons (24x24, 1.75 stroke), so no icon library is needed.
const DESENHOS: Record<Nome | 'recolher', React.ReactNode> = {
  hoje: <><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 10h18M8 2.5v4M16 2.5v4M9 15.5l2 2 4-4" /></>,
  funil: <path d="M3 4h18l-7 8.5V19l-4 2v-8.5z" />,
  clientes: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.8 0 4.5 1.9 4.5 4.5" /></>,
  remarketing: <><path d="M3 10v4h3l8 5V5L6 10z" /><path d="M17.5 9a4 4 0 0 1 0 6" /></>,
  passeios: <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  fornecedores: <><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7z" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  cobrancas: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.8" /></>,
  comissoes: <><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.2" /><circle cx="17" cy="17" r="2.2" /></>,
  painel: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  avisos: <path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4" />,
  configuracoes: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  recolher: <path d="M15 5l-7 7 7 7" />,
}

export function IconeMenu({ nome, className = 'size-5' }: { nome: Nome | 'recolher'; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`${className} shrink-0`}>
      {DESENHOS[nome]}
    </svg>
  )
}
