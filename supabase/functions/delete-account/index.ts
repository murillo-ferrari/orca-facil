// Exclui a conta de quem chama (Edge Function, Deno). As tabelas do usuário são apagadas pelo
// `on delete cascade` de auth.users. Usa a chave de serviço, que só existe aqui no servidor.
// Antes de apagar, cancela a assinatura no Mercado Pago: sem isso, quem exclui a conta continuaria sendo cobrado.
// Se o cancelamento falhar, a conta NÃO é apagada (a pessoa tenta de novo), para nunca sobrar cobrança sem conta.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cancelPreapproval, findLinkedPreapprovals } from '../_shared/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!jwt) return reply(401, { error: 'unauthorized' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  // Confere o token no Auth (assinatura e validade); só então apaga, sempre o próprio usuário
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) return reply(401, { error: 'unauthorized' })

  // Cancela as IDs vinculadas pelo servidor: assinatura ativa e checkout pendente iniciado no app. Nunca confia em
  // IDs fornecidos pelo navegador nem tenta promover/alterar assinaturas achadas por busca ampla.
  try {
    const linked = await findLinkedPreapprovals(admin, data.user.id)
    await Promise.all(linked.ids.map((id) => cancelPreapproval(id)))
  } catch (e) {
    console.error('delete-account: cancelar assinaturas', data.user.id, e instanceof Error ? e.message : e)
    return reply(502, { error: 'cancel_subscription_failed' })
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id)
  if (deleteError) {
    console.error('delete-account', data.user.id, deleteError.message)
    return reply(500, { error: 'delete_failed' })
  }
  return reply(200, { ok: true })
})
