import { useEffect, useState, type ReactNode } from 'react'
import { lazy, Suspense } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { Login } from './Login'
import SyncProvider from '../sync/SyncProvider'
import MigrationPrompt from '../sync/MigrationPrompt'
import { takeAfterLogin } from './afterLogin'

const Landing = lazy(() => import('../landing/Landing'))
const Termos = lazy(() => import('../legal/Legal').then((m) => ({ default: m.Termos })))
const Privacidade = lazy(() => import('../legal/Legal').then((m) => ({ default: m.Privacidade })))

/**
 * Logo depois do login: vai para onde a pessoa queria (ex.: página do Pro, vinda da landing) ou para o início.
 * O destino é lido uma vez, no primeiro render (o `useState` preserva o valor se o React renderizar de novo).
 */
function AfterLogin() {
  const [to] = useState(() => takeAfterLogin() ?? '/')
  return <Navigate to={to} replace />
}

/**
 * Edição Cloud. Sem sessão: `/` mostra a página inicial do produto (landing), `/entrar` e qualquer outra rota mostram
 * o login (o retorno do Google chega em /auth/callback). Com sessão: o app normal.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  // undefined = ainda carregando (o cliente lê a sessão salva ou troca o ?code= do Google)
  const [session, setSession] = useState<Session | null>()
  const { pathname } = useLocation()

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Documentos legais: públicos, com ou sem sessão (o login e a landing apontam para eles)
  if (pathname === '/termos' || pathname === '/privacidade') {
    const Doc = pathname === '/termos' ? Termos : Privacidade
    return (
      <Suspense>
        <Doc />
      </Suspense>
    )
  }
  if (session === undefined) return null
  if (!session) {
    if (pathname !== '/') return <Login />
    return (
      <Suspense>
        <Landing />
      </Suspense>
    )
  }
  if (pathname === '/auth/callback' || pathname === '/entrar') return <AfterLogin />
  return (
    <SyncProvider userId={session.user.id}>
      {children}
      <MigrationPrompt userId={session.user.id} />
    </SyncProvider>
  )
}
