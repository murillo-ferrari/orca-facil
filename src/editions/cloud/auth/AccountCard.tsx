import { useEffect, useState } from 'react'
import { LogOut, Trash2, UserRound } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { Button, Card, CardHeader } from '../../../components/ui'
import { toast } from '../../../components/toast'
import { confirmDialog } from '../../../components/confirm'
import { signOutAndClearDevice, supabase } from '../supabase'
import { useSyncState } from '../sync/controller'

const PROVIDERS: Record<string, string> = { email: 'código por e-mail', google: 'Google' }

/** Ajustes › Conta (edição Cloud): quem está conectado, sair e excluir a conta. */
export default function AccountCard() {
  const [user, setUser] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useSyncState((s) => s.pending + s.rejected)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
  }, [])

  async function deleteAccount() {
    const ok = await confirmDialog({
      title: 'Excluir conta',
      message: 'Excluir a conta e TODOS os dados na nuvem? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir conta',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
    if (error) {
      setBusy(false)
      toast('Não foi possível excluir a conta. Tente de novo.', 'error')
      return
    }
    await signOutAndClearDevice()
  }

  const providers = [...new Set(user?.identities?.map((i) => PROVIDERS[i.provider] ?? i.provider))]

  return (
    <Card>
      <CardHeader
        icon={<UserRound size={18} />}
        title="Conta"
        description={
          user ? `${user.email}${providers.length ? ` · entrou com ${providers.join(' e ')}` : ''}` : 'Carregando…'
        }
      />
      <div className="flex flex-wrap gap-2 p-4 sm:p-5">
        <Button onClick={() => void supabase.auth.signOut()} disabled={busy}>
          <LogOut size={16} /> Sair
        </Button>
        <Button
          onClick={async () => {
            const ok = await confirmDialog({
              title: 'Sair e apagar dados deste dispositivo',
              message: pending
                ? `Há ${pending} alteração(ões) que ainda NÃO foram enviadas para a nuvem e serão perdidas. Sair e apagar mesmo assim?`
                : 'Sair e apagar os dados guardados neste navegador? Eles continuam na sua conta.',
              confirmLabel: 'Sair e apagar',
              danger: !!pending,
            })
            if (ok) void signOutAndClearDevice()
          }}
          disabled={busy}
        >
          <LogOut size={16} /> Sair e apagar dados deste dispositivo
        </Button>
        <Button variant="danger" onClick={deleteAccount} disabled={busy}>
          <Trash2 size={16} /> {busy ? 'Excluindo…' : 'Excluir conta'}
        </Button>
      </div>
    </Card>
  )
}
