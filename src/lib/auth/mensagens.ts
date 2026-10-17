const MENSAGENS: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  user_already_exists: 'Já existe uma conta com esse e-mail. Entre ou recupere a senha.',
  email_exists: 'Já existe uma conta com esse e-mail. Entre ou recupere a senha.',
  weak_password: 'Senha fraca. Use ao menos 8 caracteres, com letras e números.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  over_email_send_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  email_not_confirmed: 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  same_password: 'A nova senha precisa ser diferente da anterior.',
}

// Unknown errors never reach the user verbatim (they may leak internals).
export function traduzirErroAuth(erro: { code?: string; message?: string }): string {
  return (erro.code && MENSAGENS[erro.code]) || 'Não foi possível concluir. Tente novamente em instantes.'
}
