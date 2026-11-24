-- Planos e limites: o grátis bloqueia acima do limite no servidor; o Pro libera.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@teste.local', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is((select plan_limits.max_new_quotes_per_month from public.plan_limits where plan = 'free'), 15,
  'limite do grátis: 15 orçamentos novos por mês');

-- ---------------------------------------------------------------- Empresas
insert into public.company_profiles (id, data) values
  ('a1000000-0000-4000-8000-000000000001', '{"id": "a1000000-0000-4000-8000-000000000001", "label": "Primeira"}');
select throws_ok(
  $$insert into public.company_profiles (id, data) values ('a1000000-0000-4000-8000-000000000002',
    '{"id": "a1000000-0000-4000-8000-000000000002", "label": "Segunda"}')$$,
  '42501', null, 'grátis: segunda empresa é bloqueada');

-- ---------------------------------------------------------------- Orçamentos
-- 15 orçamentos cabem no mês
do $$
declare
  i int;
  v_id uuid;
begin
  for i in 1..15 loop
    v_id := gen_random_uuid();
    insert into public.quotes (id, data) values (v_id, jsonb_build_object(
      'id', v_id, 'profileId', 'a1000000-0000-4000-8000-000000000001',
      'number', 'ORC-' || lpad(i::text, 4, '0'), 'status', 'rascunho', 'issueDate', '2026-11-18'));
  end loop;
end $$;
select is((select count(*)::int from public.quotes), 15, 'grátis: 15 orçamentos no mês são aceitos');

select throws_ok(
  $$insert into public.quotes (id, data) values ('a4000000-0000-4000-8000-000000000016',
    '{"id": "a4000000-0000-4000-8000-000000000016", "profileId": "a1000000-0000-4000-8000-000000000001", "number": "ORC-0016", "status": "rascunho", "issueDate": "2026-11-18"}')$$,
  '42501', null, 'grátis: o 16º orçamento do mês é bloqueado');

-- Apagar não devolve cota
update public.quotes set deleted_at = now() where number = 'ORC-0001';
select throws_ok(
  $$insert into public.quotes (id, data) values ('a4000000-0000-4000-8000-000000000017',
    '{"id": "a4000000-0000-4000-8000-000000000017", "profileId": "a1000000-0000-4000-8000-000000000001", "number": "ORC-0017", "status": "rascunho", "issueDate": "2026-11-18"}')$$,
  '42501', null, 'apagar um orçamento não libera cota no mês');

-- Editar orçamentos existentes continua liberado
select lives_ok($$update public.quotes set data = data || '{"title": "editado"}' where number = 'ORC-0002'$$,
  'acima do limite, editar orçamentos existentes continua liberado');

select is(public.uso_do_plano(), jsonb_build_object(
  'plano', 'free', 'orcamentos_no_mes', 15, 'limite_orcamentos_no_mes', 15, 'empresas', 1, 'limite_empresas', 1),
  'uso_do_plano informa uso e limites');

-- Orçamentos de meses anteriores não contam
reset role;
-- O gatilho protege inserted_at até do administrador; desligamos os gatilhos só para montar o cenário
set local session_replication_role = replica;
update public.quotes set inserted_at = now() - interval '2 months';
set local session_replication_role = origin;
set local role authenticated;
select lives_ok(
  $$insert into public.quotes (id, data) values ('a4000000-0000-4000-8000-000000000018',
    '{"id": "a4000000-0000-4000-8000-000000000018", "profileId": "a1000000-0000-4000-8000-000000000001", "number": "ORC-0018", "status": "rascunho", "issueDate": "2026-11-18"}')$$,
  'a cota recomeça a cada mês');

-- ---------------------------------------------------------------- Pro (gravado pelo servidor, como fará o webhook)
reset role;
update public.subscriptions set plan = 'pro', status = 'active', current_period_end = now() + interval '30 days';
set local role authenticated;
select lives_ok(
  $$insert into public.company_profiles (id, data) values ('a1000000-0000-4000-8000-000000000003',
    '{"id": "a1000000-0000-4000-8000-000000000003", "label": "Segunda (Pro)"}')$$,
  'Pro: várias empresas');

-- Inadimplência: até 7 dias após o fim do período ainda vale o Pro; depois volta ao grátis
reset role;
update public.subscriptions set status = 'past_due', current_period_end = now() - interval '3 days';
set local role authenticated;
select is(public.uso_do_plano() ->> 'plano', 'pro', 'Pro vale até 7 dias após o vencimento');

reset role;
update public.subscriptions set current_period_end = now() - interval '8 days';
set local role authenticated;
select is(public.uso_do_plano() ->> 'plano', 'free', 'depois de 7 dias de atraso volta ao grátis');
select is((select count(*)::int from public.company_profiles where deleted_at is null), 2,
  'voltar ao grátis não apaga nada (só bloqueia criar acima do limite)');

-- ---------------------------------------------------------------- Preços (F7)
set local role authenticated;
select is((select array_agg(amount::text order by months) from public.plan_prices), array['9.99', '99.99'],
  'Pro: R$ 9,99/mês e R$ 99,99/ano');
select throws_ok($$update public.plan_prices set amount = 0.01$$, '42501', null, 'usuário não altera preços');
select throws_ok($$update public.subscriptions set billing_interval = 'anual'$$, '42501', null,
  'usuário não altera a própria assinatura');
select throws_ok($$select * from public.billing_events$$, '42501', null, 'usuário não lê eventos de cobrança');

select * from finish();
rollback;
