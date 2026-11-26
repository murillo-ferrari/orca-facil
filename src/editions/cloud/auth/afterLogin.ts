const KEY = 'orcafacil:depois-do-login'

/** Guarda para onde levar a pessoa depois do login (ex.: a página do Pro, vinda da landing). Vale para código e Google. */
export function rememberAfterLogin(path: string) {
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    /* sem storage: a pessoa cai na tela inicial, sem prejuízo */
  }
}

/** Lê e esquece o destino guardado. Só aceita caminhos internos. */
export function takeAfterLogin(): string | null {
  try {
    const path = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return path?.startsWith('/') && !path.startsWith('//') ? path : null
  } catch {
    return null
  }
}
