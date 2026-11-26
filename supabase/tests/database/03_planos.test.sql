-- Plano: na nuvem só escreve quem tem Pro vigente; sem plano, a conta só lê (nada é apagado).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@teste.local', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- ---------------------------------------------------------------- Conta nova: sem plano, só lê
select is((select plan from public.subscriptions), 'free', 'conta nova não tem plano (free = sem assinatura)');
select throws_ok(
  $$insert into public.company_profiles (id, data) values ('a1000000-0000-4000-8000-000000000001',
    '{"id": "a1000000-0000-4000-8000-000000000001", "label": "Empresa"}')$$,
  '42501', null, 'sem Pro: não cria empresa');
select throws_ok(
  $$insert into public.clients (id, data) values ('a2000000-0000-4000-8000-000000000001',
    '{"id": "a2000000-0000-4000-8000-000000000001", "name": "Maria"}')$$,
  '42501', null, 'sem Pro: não cria cliente');
select throws_ok(
  $$insert into public.quotes (id, data) values ('a4000000-0000-4000-8000-000000000001',
    '{"id": "a4000000-0000-4000-8000-000000000001", "profileId": "a1000000-0000-4000-8000-000000000001", "number": "ORC-0001", "status": "rascunho", "issueDate": "2026-11-18"}')$$,
  '42501', null, 'sem Pro: não cria orçamento');
select throws_ok($$update public.user_settings set data = data || '{"x": 1}'$$, '42501', null,
  'sem Pro: não altera as configurações');
select is((select count(*)::int from public.user_settings), 1, 'sem Pro: ainda lê os próprios dados');

-- A função de sincronização também recusa, item a item, como "sem_permissao"
select is(
  (select public.aplicar_alteracoes('[{"table": "clients", "id": "a2000000-0000-4000-8000-000000000001", "base_rev": null, "data": {"id": "a2000000-0000-4000-8000-000000000001", "name": "Maria"}}]'::jsonb) #>> '{rejected,0,reason}'),
  'sem_permissao', 'sem Pro: o envio de dados é recusado como sem_permissao');

-- ---------------------------------------------------------------- Pro (gravado pelo servidor, como faz a função de assinatura)
reset role;
update public.subscriptions set plan = 'pro', status = 'active', current_period_end = now() + interval '30 days';
set local role authenticated;
insert into public.company_profiles (id, data) values
  ('a1000000-0000-4000-8000-000000000001', '{"id": "a1000000-0000-4000-8000-000000000001", "label": "Empresa"}'),
  ('a1000000-0000-4000-8000-000000000002', '{"id": "a1000000-0000-4000-8000-000000000002", "label": "Outra"}');
select is((select count(*)::int from public.company_profiles), 2, 'Pro: cria quantas empresas quiser');
do $$
declare
  i int;
  v_id uuid;
begin
  for i in 1..30 loop
    v_id := gen_random_uuid();
    insert into public.quotes (id, data) values (v_id, jsonb_build_object(
      'id', v_id, 'profileId', 'a1000000-0000-4000-8000-000000000001',
      'number', 'ORC-' || lpad(i::text, 4, '0'), 'status', 'rascunho', 'issueDate', '2026-11-18'));
  end loop;
end $$;
select is((select count(*)::int from public.quotes), 30, 'Pro: sem limite de orçamentos por mês');
select lives_ok($$update public.quotes set data = data || '{"title": "editado"}' where number = 'ORC-0002'$$,
  'Pro: altera orçamentos');

-- ---------------------------------------------------------------- Inadimplência: tolerância de 7 dias, depois só leitura
reset role;
update public.subscriptions set status = 'past_due', current_period_end = now() - interval '3 days';
set local role authenticated;
select lives_ok($$update public.quotes set data = data || '{"title": "ainda vale"}' where number = 'ORC-0003'$$,
  'até 7 dias após o vencimento ainda vale o Pro');

reset role;
update public.subscriptions set current_period_end = now() - interval '8 days';
set local role authenticated;
select throws_ok($$update public.quotes set data = data || '{"title": "bloqueado"}' where number = 'ORC-0004'$$,
  '42501', null, 'depois de 7 dias de atraso não altera mais');
select throws_ok(
  $$insert into public.clients (id, data) values ('a2000000-0000-4000-8000-000000000002',
    '{"id": "a2000000-0000-4000-8000-000000000002", "name": "Bia"}')$$,
  '42501', null, 'depois de 7 dias de atraso não cria mais');
select is((select count(*)::int from public.quotes), 30, 'voltar a sem plano não apaga nada: continua lendo tudo');
select is((select count(*)::int from public.company_profiles), 2, 'nem as empresas');

-- Assinatura cancelada com período pago ainda vigente continua valendo
reset role;
update public.subscriptions set status = 'canceled', current_period_end = now() + interval '10 days';
set local role authenticated;
select lives_ok($$update public.quotes set data = data || '{"title": "cancelada, mas paga"}' where number = 'ORC-0005'$$,
  'cancelada vale até o fim do período pago');

-- ---------------------------------------------------------------- Preços
select is((select array_agg(amount::text order by months) from public.plan_prices), array['9.99', '99.99'],
  'Pro: R$ 9,99/mês e R$ 99,99/ano');
select throws_ok($$update public.plan_prices set amount = 0.01$$, '42501', null, 'usuário não altera preços');
select throws_ok($$update public.subscriptions set billing_interval = 'anual'$$, '42501', null,
  'usuário não altera a própria assinatura');

-- Visitante (sem login) lê só os preços, e só lê
reset role;
set local role anon;
select is((select count(*)::int from public.plan_prices), 2, 'visitante vê os dois preços');

select * from finish();
rollback;
