-- =============================================================================
-- Edição Cloud — planos, limites e assinaturas
-- Ver docs/plano-versao-cloud.md, seção 9.
--
-- A tabela `subscriptions` é a fonte da verdade do plano. Ela só é gravada pelo servidor (gatilho de
-- cadastro e, na fase F7, pela Edge Function do webhook de pagamento). Os limites são aplicados nas
-- policies de INSERT, então não dá para contorná-los alterando o app.
-- =============================================================================

-- Limites por plano (null = ilimitado). Ajustáveis sem nova migração.
create table public.plan_limits (
  plan                     text primary key,
  max_new_quotes_per_month integer check (max_new_quotes_per_month is null or max_new_quotes_per_month >= 0),
  max_company_profiles     integer check (max_company_profiles is null or max_company_profiles >= 0)
);

insert into public.plan_limits (plan, max_new_quotes_per_month, max_company_profiles) values
  ('free', 15, 1),
  ('pro', null, null);

alter table public.plan_limits enable row level security;
create policy "todos os usuários leem os limites" on public.plan_limits for select to authenticated using (true);
revoke all on public.plan_limits from anon;
revoke insert, update, delete, truncate on public.plan_limits from authenticated;

create table public.subscriptions (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  plan                     text not null default 'free' references public.plan_limits (plan),
  status                   text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  -- Fim do período pago; o Pro segue valendo até 7 dias depois (tolerância de inadimplência)
  current_period_end       timestamptz,
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  updated_at               timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy "dono lê a própria assinatura" on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.subscriptions from anon;
revoke insert, update, delete, truncate on public.subscriptions from authenticated;

-- Eventos recebidos do provedor de pagamento (idempotência e auditoria). Só o servidor acessa.
create table public.billing_events (
  id           bigint generated always as identity primary key,
  provider     text not null,
  event_id     text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Plano efetivo e limites
-- -----------------------------------------------------------------------------

-- Plano em vigor para o usuário autenticado
create function private.current_plan()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when s.plan = 'pro' and (s.current_period_end is null or s.current_period_end > now() - interval '7 days')
        then 'pro'
      else 'free'
    end
    from public.subscriptions s
    where s.user_id = auth.uid()
  ), 'free');
$$;

-- Orçamentos criados no mês corrente (fuso de São Paulo). Conta também os excluídos, para que apagar e
-- recriar não "devolva" cota.
create function private.quotes_created_this_month()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.quotes q
  where q.user_id = auth.uid()
    and q.inserted_at >= (date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
$$;

create function private.can_create_quote()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select l.max_new_quotes_per_month is null
      or private.quotes_created_this_month() < l.max_new_quotes_per_month
  from public.plan_limits l
  where l.plan = private.current_plan();
$$;

create function private.can_create_company_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select l.max_company_profiles is null
      or (select count(*) from public.company_profiles p
          where p.user_id = auth.uid() and p.deleted_at is null) < l.max_company_profiles
  from public.plan_limits l
  where l.plan = private.current_plan();
$$;

revoke all on function private.current_plan(), private.quotes_created_this_month(), private.can_create_quote(),
  private.can_create_company_profile() from public;
grant execute on function private.current_plan(), private.quotes_created_this_month(), private.can_create_quote(),
  private.can_create_company_profile() to authenticated;

-- Criação de orçamentos e empresas respeita o plano
create policy "dono cria (respeitando o plano)" on public.quotes for insert to authenticated
  with check ((select auth.uid()) = user_id and private.can_create_quote());
create policy "dono cria (respeitando o plano)" on public.company_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and private.can_create_company_profile());

-- Uso do plano, para a tela de planos (RPC: supabase.rpc('uso_do_plano'))
create function public.uso_do_plano()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'plano', private.current_plan(),
    'orcamentos_no_mes', private.quotes_created_this_month(),
    'limite_orcamentos_no_mes', l.max_new_quotes_per_month,
    'empresas', (select count(*) from public.company_profiles p where p.user_id = auth.uid() and p.deleted_at is null),
    'limite_empresas', l.max_company_profiles
  )
  from public.plan_limits l
  where l.plan = private.current_plan();
$$;

revoke all on function public.uso_do_plano() from public, anon;
grant execute on function public.uso_do_plano() to authenticated;

-- -----------------------------------------------------------------------------
-- Dados iniciais de cada usuário novo (substitui um webhook de cadastro)
-- -----------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (id, user_id) values (new.id, new.id);
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
