import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { closeSync } from './sync/controller'
import { deleteSyncDb } from './sync/idb'

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
 * Sai e apaga a cópia local deste usuário neste navegador (IndexedDB), depois volta para a tela de login.
 * Para o uso em computador compartilhado e para a exclusão de conta. Se houver alterações ainda não enviadas,
 * elas se perdem: quem chama avisa a pessoa antes.
 */
export async function signOutAndClearDevice() {
  const { data } = await supabase.auth.getSession()
  await closeSync()
  if (data.session) await deleteSyncDb(data.session.user.id)
  await supabase.auth.signOut({ scope: 'local' })
  sessionStorage.removeItem('gerador-orcamento:filtros-relatorios')
  location.assign('/')
}
