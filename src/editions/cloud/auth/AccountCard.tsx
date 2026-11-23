import { useEffect, useState } from 'react'
import { LogOut, Trash2, UserRound } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { Button, Card, CardHeader } from '../../../components/ui'
import { toast } from '../../../components/toast'
import { signOutAndClearDevice, supabase } from '../supabase'

const PROVIDERS: Record<string, string> = { email: 'código por e-mail', google: 'Google' }

/** Ajustes › Conta (edição Cloud): quem está conectado, sair e excluir a conta. */
export default function AccountCard() {
  const [user, setUser] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
  }, [])

  async function deleteAccount() {
    if (!window.confirm('Excluir a conta e TODOS os dados na nuvem? Esta ação não pode ser desfeita.')) return
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
          user ? `${user.email}${providers.length ? ` · entra com ${providers.join(' e ')}` : ''}` : 'Carregando…'
        }
      />
      <div className="flex flex-wrap gap-2 p-4 sm:p-5">
        <Button onClick={() => void supabase.auth.signOut()} disabled={busy}>
          <LogOut size={16} /> Sair
        </Button>
        <Button
          onClick={() =>
            window.confirm('Sair e apagar os dados guardados neste navegador?') && void signOutAndClearDevice()
          }
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
