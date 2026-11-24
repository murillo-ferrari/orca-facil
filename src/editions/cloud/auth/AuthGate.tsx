import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { Login } from './Login'
import SyncProvider from '../sync/SyncProvider'
import MigrationPrompt from '../sync/MigrationPrompt'

/** Edição Cloud: sem sessão, qualquer rota mostra o login; com sessão, o app normal. */
export default function AuthGate({ children }: { children: ReactNode }) {
  // undefined = ainda carregando (o cliente lê a sessão salva ou troca o ?code= do Google)
  const [session, setSession] = useState<Session | null>()
  const { pathname } = useLocation()

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />
  if (pathname === '/auth/callback') return <Navigate to="/" replace />
  return (
    <SyncProvider userId={session.user.id}>
      {children}
      <MigrationPrompt userId={session.user.id} />
    </SyncProvider>
  )
}
