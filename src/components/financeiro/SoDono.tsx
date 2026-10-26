import { EstadoVazio } from '@/components/tela/EstadoVazio'

// R144: what a seller sees on an owner-only Financeiro screen.
export function SoDono() {
  return (
    <EstadoVazio acoes={[{ href: '/cobrancas', rotulo: 'Ver cobranças' }, { href: '/comissoes', rotulo: 'Ver minhas comissões' }]}>
      Só o dono vê o financeiro da agência. Você pode acompanhar as cobranças e as suas comissões.
    </EstadoVazio>
  )
}
