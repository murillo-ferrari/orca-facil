-- Preços do plano Pro visíveis para visitantes (página inicial da edição Cloud, antes do login).
-- É informação pública (a própria landing a mostra), só leitura; ninguém sem login altera nada.
create policy "visitantes leem os preços" on public.plan_prices for select to anon using (true);
grant select on public.plan_prices to anon;
