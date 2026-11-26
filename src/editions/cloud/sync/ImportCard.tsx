import { useRef, useState } from 'react'
import { CloudUpload, FileUp } from 'lucide-react'
import { Button, Card, CardHeader } from '../../../components/ui'
import { toast } from '../../../components/toast'
import { confirmDialog } from '../../../components/confirm'
import { BackupError, parseBackup } from '../../../data/backup'
import { STORAGE_KEY } from '../../../data/schema'
import { usePlan } from '../billing/planStore'
import { importLocal } from './controller'
import { countsOf, describeCounts, fromBackup, readLocalEdition } from './migration'

/**
 * Ajustes › Enviar dados para a nuvem (edição Cloud): é a segunda chance de importar (o aviso do primeiro login pode
 * ter sido dispensado) e a porta para o arquivo de backup de outro computador. Sempre SOMA aos dados da conta.
 */
export default function ImportCard() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [hasLocal, setHasLocal] = useState(() => readLocalEdition() !== null)
  const pro = usePlan((s) => s.view.pro)

  async function send(data: ReturnType<typeof fromBackup>, label: string, clearLocal: boolean) {
    const counts = describeCounts(countsOf(data))
    const ok = await confirmDialog({
      title: 'Enviar dados para a nuvem',
      message: `Enviar ${counts} (${label}) para a sua conta? Eles serão somados aos dados que ela já tem.`,
      confirmLabel: 'Enviar',
    })
    if (!ok) return
    setBusy(true)
    const r = await importLocal(data)
    setBusy(false)
    if (!r?.ok) {
      toast('Não foi possível enviar agora. Tente de novo.', 'error')
      return
    }
    if (clearLocal) {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignorado */
      }
      setHasLocal(false)
    }
    toast(
      r.refused
        ? `${r.refused} item(ns) não foram enviados: a nuvem exige o plano Pro.`
        : 'Dados enviados para a sua conta',
    )
  }

  async function fromFile(file: File) {
    let data
    try {
      data = fromBackup(parseBackup(await file.text()))
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'Arquivo de backup inválido', 'error')
      return
    }
    await send(data, 'do arquivo de backup', false)
  }

  return (
    <Card>
      <CardHeader
        icon={<CloudUpload size={18} />}
        title="Enviar dados para a nuvem"
        description="Traz para a sua conta os dados da versão gratuita deste navegador ou de um arquivo de backup. Os dados são somados aos da conta, nunca substituídos."
      />
      <div className="flex flex-wrap gap-2 p-4 sm:p-5">
        {hasLocal && (
          <Button
            variant="primary"
            disabled={busy || !pro}
            onClick={() => {
              const data = readLocalEdition()
              if (data) void send(data, 'deste navegador', true)
            }}
          >
            <CloudUpload size={16} /> Enviar dados deste navegador
          </Button>
        )}
        <Button disabled={busy || !pro} onClick={() => fileRef.current?.click()}>
          <FileUp size={16} /> Enviar de um arquivo de backup
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void fromFile(f)
            e.target.value = ''
          }}
        />
      </div>
      {!pro && (
        <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">
          Disponível com o plano Pro, que liga a conta à nuvem.
        </p>
      )}
      {pro && !hasLocal && (
        <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">Não há dados da versão gratuita neste navegador.</p>
      )}
    </Card>
  )
}
