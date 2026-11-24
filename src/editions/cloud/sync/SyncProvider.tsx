import { useEffect, type ReactNode } from 'react'
import { startSync, stopSync, useSyncState } from './controller'

/** Abre a cópia local e a sincronização do usuário logado; só mostra o app depois de carregar os dados. */
export default function SyncProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const phase = useSyncState((s) => s.phase)

  useEffect(() => {
    startSync(userId)
    return stopSync
  }, [userId])

  return phase === 'loading' ? null : children
}
