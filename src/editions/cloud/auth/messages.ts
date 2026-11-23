/** Mensagens em pt-BR para os erros do Supabase Auth (campo `code` do AuthError). */
const MESSAGES: Record<string, string> = {
  otp_expired: 'Código inválido ou expirado. Confira o código ou peça um novo.',
  over_email_send_rate_limit: 'Muitos envios seguidos. Aguarde um minuto e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  captcha_failed: 'Não foi possível confirmar que você não é um robô. Tente de novo.',
  email_address_invalid: 'Este e-mail não é válido.',
  signup_disabled: 'Novos cadastros estão fechados no momento.',
}

export function authErrorMessage(error: { code?: string } | null | undefined) {
  return (error?.code && MESSAGES[error.code]) || 'Não foi possível concluir. Verifique a conexão e tente de novo.'
}
