-- F8 · Segurança (correções encontradas na revisão de 26/11/2026)

-- Uma assinatura iniciada pelo app mas ainda pendente não deve gerar novos checkouts e cobranças duplicadas.
-- O ID é gravado pelo servidor no momento em que o checkout é criado; ele próprio nunca concede Pro.
alter table public.subscriptions
  add column pending_subscription_id text,
  add column pending_amount numeric(10, 2) check (pending_amount is null or pending_amount > 0),
  add column pending_billing_interval text references public.plan_prices (billing_interval),
  add column pending_checkout_at timestamptz,
  add column pending_checkout_token uuid,
  add column billing_interval_contracted text check (billing_interval_contracted in ('mensal', 'anual'));

-- Recupera o período contratado das assinaturas existentes antes de qualquer reajuste.
update public.subscriptions set billing_interval_contracted = billing_interval where billing_interval is not null;

-- Se a instância cair depois de reservar mas antes de criar o checkout, libera a reserva em dois minutos.
create index subscriptions_pending_checkout_idx on public.subscriptions (pending_checkout_at)
  where pending_checkout_at is not null;

-- Reserva de um checkout por usuário. A Edge Function (service_role) passa o user_id do JWT validado.
-- O lock na linha de subscription serializa dois cliques concorrentes; clock_timestamp avança enquanto se espera o lock.
create function public.iniciar_checkout(p_user uuid, p_interval text)
returns table (pending_subscription_id text, pending_amount numeric, pending_billing_interval text, checkout_token uuid, create_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_checkout_token uuid := gen_random_uuid();
  v_price public.plan_prices%rowtype;
begin
  if p_user is null then raise exception 'user_id obrigatório' using errcode = 'invalid_parameter_value'; end if;
  select * into v_price from public.plan_prices where billing_interval = p_interval;
  if not found then raise exception 'período inválido' using errcode = '22023'; end if;

  insert into public.subscriptions (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into v_sub from public.subscriptions where subscriptions.user_id = p_user for update;

  if v_sub.pending_subscription_id is not null then
    return query select v_sub.pending_subscription_id, v_sub.pending_amount,
      v_sub.pending_billing_interval, v_sub.pending_checkout_token, false;
    return;
  end if;
  if v_sub.pending_checkout_at is not null
     and v_sub.pending_checkout_at > clock_timestamp() - interval '2 minutes' then
    return query select null::text, v_sub.pending_amount,
      v_sub.pending_billing_interval, v_sub.pending_checkout_token, false;
    return;
  end if;

  update public.subscriptions set
    pending_subscription_id = null,
    pending_amount = v_price.amount,
    pending_billing_interval = p_interval,
    pending_checkout_at = clock_timestamp(),
    pending_checkout_token = v_checkout_token
  where subscriptions.user_id = p_user;
  return query select null::text, v_price.amount, p_interval, v_checkout_token, true;
end;
$$;
revoke all on function public.iniciar_checkout(uuid, text) from public, anon, authenticated;
grant execute on function public.iniciar_checkout(uuid, text) to service_role;

-- O Pro guarda o preço contratado. Uma mudança de plan_prices só vale para assinaturas novas; renovação ou
-- cancelamento de uma assinatura antiga continuam a bater com o valor originalmente acordado.
alter table public.subscriptions
  add column provider_amount numeric(10, 2) check (provider_amount is null or provider_amount > 0);

-- Backfill: assinaturas Pro existentes passam a guardar o valor vigente no período contratado.
update public.subscriptions s
set provider_amount = p.amount
from public.plan_prices p
where s.plan = 'pro' and s.billing_interval = p.billing_interval and s.provider_amount is null;


-- A confirmação do e-mail é configurada em `supabase/config.toml` (`[auth.email].enable_confirmations`), não no SQL.
-- No projeto remoto, conferir o mesmo controle em Authentication → Settings → User Signups → Confirm email.
