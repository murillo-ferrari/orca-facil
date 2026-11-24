-- =============================================================================
-- Cobrança do plano Pro (F7). Ver docs/plano-versao-cloud.md, seção 9.
--
-- Decisões: D4 = Mercado Pago (assinaturas "preapproval"); D5 = Pro a R$ 9,99/mês ou R$ 99,99/ano.
-- Os preços ficam no banco: a Edge Function `assinatura` lê daqui o valor a cobrar (o app nunca informa valor) e a
-- tela de planos mostra os mesmos números. Mudar preço = um UPDATE, sem novo deploy (vale para assinaturas novas).
-- =============================================================================

create table public.plan_prices (
  billing_interval text primary key check (billing_interval in ('mensal', 'anual')),
  amount           numeric(10, 2) not null check (amount > 0),
  months           integer not null check (months > 0)
);

insert into public.plan_prices (billing_interval, amount, months) values
  ('mensal', 9.99, 1),
  ('anual', 99.99, 12);

alter table public.plan_prices enable row level security;
create policy "todos os usuários leem os preços" on public.plan_prices for select to authenticated using (true);
revoke all on public.plan_prices from anon, authenticated;
grant select on public.plan_prices to authenticated;
grant all on public.plan_prices to service_role;

-- Periodicidade da assinatura em vigor (para a tela mostrar "Pro anual"); gravada só pelo servidor
alter table public.subscriptions
  add column billing_interval text references public.plan_prices (billing_interval);
