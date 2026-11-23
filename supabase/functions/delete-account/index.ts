// Exclui a conta de quem chama (Edge Function, Deno). As tabelas do usuário são apagadas pelo
// `on delete cascade` de auth.users. Usa a chave de serviço, que só existe aqui no servidor.
// F7: antes de apagar, cancelar a assinatura no provedor de pagamento.
import { createClient } from 'npm:@supabase/supabase-js@2'

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

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id)
  if (deleteError) {
    console.error('delete-account', data.user.id, deleteError.message)
    return reply(500, { error: 'delete_failed' })
  }
  return reply(200, { ok: true })
})
