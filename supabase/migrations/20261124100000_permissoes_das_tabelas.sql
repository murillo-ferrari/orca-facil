-- =============================================================================
-- Permissões (GRANT) das tabelas
--
-- As migrações anteriores definem as policies de RLS, mas nenhum GRANT: elas dependiam de o Supabase liberar as
-- tabelas novas sozinho. O banco local faz isso; o projeto online não. Sem o GRANT, o papel `authenticated` leva
-- "permission denied for table ..." antes mesmo de a RLS ser avaliada.
--
-- A RLS continua sendo quem decide QUAIS linhas cada usuário enxerga; o GRANT só decide QUAIS operações existem.
-- Usuários não apagam fisicamente (exclusão é lógica, via deleted_at), então DELETE e TRUNCATE não são concedidos.
-- O papel `anon` (visitante sem login) não recebe nada.
-- =============================================================================

grant select, insert, update on
  public.user_settings, public.company_profiles, public.clients, public.catalog_items, public.quotes
  to authenticated;

-- Só leitura para o usuário: quem altera planos e assinaturas é o servidor (Edge Functions, F7)
grant select on public.plan_limits, public.subscriptions to authenticated;

-- billing_events: só o servidor acessa (sem acesso para authenticated)

-- Edge Functions (chave de serviço): acesso total; a RLS não vale para este papel
grant all on
  public.user_settings, public.company_profiles, public.clients, public.catalog_items, public.quotes,
  public.plan_limits, public.subscriptions, public.billing_events
  to service_role;
