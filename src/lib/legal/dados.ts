// Values still to be filled in by the owner before any real use. While one of them keeps a
// "[PREENCHER" / "[CONFIRMAR" marker, the legal pages show a "draft" warning.
export const PENDENTES = {
  controlador: '[PREENCHER: nome ou razão social e CPF/CNPJ do responsável pelo crTOUR]',
  contato: '[PREENCHER: e-mail de contato e do encarregado de dados]',
  foro: '[PREENCHER: comarca do foro]',
  regiao: '[CONFIRMAR: país e região dos servidores do banco de dados]',
  backups: '[CONFIRMAR: prazo de retenção de backups]',
  responsabilidade: '[PREENCHER: limites de responsabilidade, revisados por advogado]',
}

export const VERSAO_TEXTO = '17/10/2026 (rascunho)'

export function temPendencias(valores: Record<string, string> = PENDENTES): boolean {
  return Object.values(valores).some((v) => v.includes('[PREENCHER') || v.includes('[CONFIRMAR'))
}
