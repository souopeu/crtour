export type Viagem = {
  reservaId: string
  passeio: string
  saidaData: string // YYYY-MM-DD
  qtd: number
  situacao: 'ativa' | 'cancelada'
  total: number
  pago: number
  saldo: number
  papel: 'Responsável' | 'Acompanhante'
}

// Upcoming trips (today included) soonest first; past trips most recent first.
export function separarViagens(viagens: Viagem[], hoje: string): { futuras: Viagem[]; passadas: Viagem[] } {
  const futuras = viagens.filter((v) => v.saidaData >= hoje).sort((a, b) => a.saidaData.localeCompare(b.saidaData))
  const passadas = viagens.filter((v) => v.saidaData < hoje).sort((a, b) => b.saidaData.localeCompare(a.saidaData))
  return { futuras, passadas }
}

// What this client still owes: only active reservations they are responsible for.
export function saldoEmAberto(viagens: Viagem[]): number {
  return viagens
    .filter((v) => v.situacao === 'ativa' && v.papel === 'Responsável' && v.saldo > 0)
    .reduce((soma, v) => soma + v.saldo, 0)
}
