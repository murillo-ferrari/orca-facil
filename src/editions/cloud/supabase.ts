import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { STORAGE_KEY } from '../../data/schema'

/**
 * Cliente Supabase da edição Cloud. As variáveis são exigidas no build (vite.config.ts).
 * PKCE: o retorno do Google chega como `?code=` e o próprio cliente troca pela sessão ao carregar a página.
 */
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { flowType: 'pkce' } },
)

/**
 * Apaga os dados deste navegador e recarrega o app (volta para a tela de login).
 * ponytail: na F4 os dados ainda ficam no localStorage, compartilhado entre contas do mesmo navegador;
 * a F5 troca por cópia local separada por usuário (IndexedDB) e esta função passa a limpá-la.
 */
export async function signOutAndClearDevice() {
  await supabase.auth.signOut({ scope: 'local' })
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem('gerador-orcamento:filtros-relatorios')
  location.assign('/')
}
