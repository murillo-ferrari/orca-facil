import { useEffect, useState } from 'react'
import { Button, Modal } from '../../../components/ui'
import { toast } from '../../../components/toast'
import { STORAGE_KEY } from '../../../data/schema'
import { useStore } from '../../../store/store'
import { usePlan, watchPlan } from '../billing/planStore'
import { importLocal, useSyncState } from './controller'
import {
  countsOf,
  declineMigration,
  describeCounts,
  hasContent,
  isMigrationDeclined,
  readLocalEdition,
} from './migration'

/**
 * Primeiro login com dados da edição Local neste navegador: oferece enviar para a conta, com confirmação.
 * Nunca envia sozinho. Aparece depois da primeira sincronização, para já saber se a conta tem dados.
 * "Agora não" lembra a escolha neste navegador e nesta conta; Ajustes › Enviar dados para a nuvem continua disponível.
 */
export default function MigrationPrompt({ userId }: { userId: string }) {
  const synced = useSyncState((s) => s.synced)
  const accountHasData = useStore((s) => hasContent(s))
  // Só oferece com plano Pro: sem ele o servidor recusaria o envio
  const pro = usePlan((s) => s.view.pro)
  useEffect(watchPlan, [])
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  // Lido uma vez ao montar; só aparece depois da primeira sincronização (a conta já é conhecida)
  const [local] = useState(() => (isMigrationDeclined(userId) ? null : readLocalEdition()))

  if (!synced || !pro || dismissed || !local) return null
  const data = local // referência não nula para dentro de send()
  const counts = describeCounts(countsOf(data))
  const decline = () => {
    declineMigration(userId)
    setDismissed(true)
  }

  async function send() {
    setBusy(true)
    const r = await importLocal(data)
    setBusy(false)
    if (!r?.ok) {
      toast('Não foi possível enviar agora. Seus dados continuam neste navegador; tente de novo em Ajustes.', 'error')
      return
    }
    // Os dados do navegador já estão na conta; limpa a cópia da edição Local para não oferecer de novo
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignorado */
    }
    setDismissed(true)
    toast(
      r.refused
        ? `${r.refused} item(ns) não foram enviados: a nuvem exige o plano Pro. Seus dados continuam neste dispositivo.`
        : 'Dados enviados para a sua conta',
    )
  }

  return (
    <Modal
      open
      onClose={decline}
      title="Enviar seus dados para a nuvem?"
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={decline}>
            Agora não
          </Button>
          <Button variant="primary" disabled={busy} onClick={send}>
            {busy ? 'Enviando…' : 'Enviar meus dados'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          Encontramos neste navegador dados da versão no aparelho (grátis): <strong>{counts}</strong>.
        </p>
        <p>
          {accountHasData
            ? 'A sua conta já tem dados. Os dados deste navegador serão somados a eles, sem apagar nada: se o mesmo item existir nos dois lugares, fica o mais recente.'
            : 'Eles serão copiados para a sua conta e ficarão disponíveis em todos os seus dispositivos.'}
        </p>
        <p className="text-slate-500">
          Nada é apagado deste navegador até o envio terminar. Se escolher &quot;Agora não&quot;, você pode enviar
          depois em Ajustes.
        </p>
      </div>
    </Modal>
  )
}
