-- Isolamento entre usuários: ninguém lê, altera, adota nem apaga dados de outra pessoa.
-- Rodar com: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Usuários de teste (o gatilho de cadastro cria as configurações e a assinatura)
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@teste.local', 'authenticated', 'authenticated'),
  ('b0000000-0000-4000-8000-000000000002', 'bia@teste.local', 'authenticated', 'authenticated');

-- ---------------------------------------------------------------- Ana cria dados
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

insert into public.company_profiles (id, data) values
  ('a1000000-0000-4000-8000-000000000001', '{"id": "a1000000-0000-4000-8000-000000000001", "label": "Empresa da Ana", "nextNumber": 1}');
insert into public.clients (id, data) values
  ('a2000000-0000-4000-8000-000000000001', '{"id": "a2000000-0000-4000-8000-000000000001", "name": "Cliente da Ana", "document": "529.982.247-25"}');
insert into public.catalog_items (id, data) values
  ('a3000000-0000-4000-8000-000000000001', '{"id": "a3000000-0000-4000-8000-000000000001", "description": "Pintura"}');
insert into public.quotes (id, data) values
  ('a4000000-0000-4000-8000-000000000001', '{"id": "a4000000-0000-4000-8000-000000000001", "profileId": "a1000000-0000-4000-8000-000000000001", "number": "ORC-0001", "status": "rascunho", "issueDate": "2026-11-18"}');

select is((select count(*)::int from public.quotes), 1, 'Ana vê o próprio orçamento');
select is((select user_id from public.quotes), 'a0000000-0000-4000-8000-000000000001'::uuid,
  'o dono é definido pelo servidor, sem o app enviar user_id');
select is((select count(*)::int from public.user_settings), 1, 'Ana vê as próprias configurações (criadas no cadastro)');
select is((select plan from public.subscriptions), 'free', 'Ana começa no plano grátis');

-- ---------------------------------------------------------------- Bia tenta acessar
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is_empty('select 1 from public.company_profiles', 'Bia não vê empresas da Ana');
select is_empty('select 1 from public.clients', 'Bia não vê clientes da Ana');
select is_empty('select 1 from public.catalog_items', 'Bia não vê o catálogo da Ana');
select is_empty('select 1 from public.quotes', 'Bia não vê orçamentos da Ana');
select is((select count(*)::int from public.user_settings), 1, 'Bia vê só as próprias configurações');
select is((select count(*)::int from public.subscriptions), 1, 'Bia vê só a própria assinatura');

-- Alterar linha alheia não afeta nada (a linha é invisível para ela)
update public.quotes set data = data || '{"title": "invadido"}' where id = 'a4000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::int from public.quotes where id = 'a4000000-0000-4000-8000-000000000001'), 0,
  'Bia não consegue alterar o orçamento da Ana');

-- Tentar gravar em nome da Ana: o servidor troca o dono para quem está autenticado
insert into public.clients (id, user_id, data) values
  ('b2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   '{"id": "b2000000-0000-4000-8000-000000000001", "name": "Plantado"}');
select is((select user_id from public.clients where id = 'b2000000-0000-4000-8000-000000000001'),
  'b0000000-0000-4000-8000-000000000002'::uuid, 'não dá para criar registro em nome de outra pessoa');

-- Reaproveitar o id de um registro da Ana não sobrescreve nada
select throws_ok(
  $$insert into public.clients (id, data) values ('a2000000-0000-4000-8000-000000000001',
    '{"id": "a2000000-0000-4000-8000-000000000001", "name": "Sequestro"}')$$,
  '23505', null, 'id já usado por outra pessoa é recusado (sem sobrescrever)');

-- Apagar fisicamente não é permitido para usuários
select throws_ok('delete from public.clients', '42501', null, 'usuário não apaga linhas fisicamente');

-- Assinatura não pode ser alterada pelo próprio usuário
select throws_ok($$update public.subscriptions set plan = 'pro'$$, '42501', null,
  'usuário não se promove a Pro sozinho');
select throws_ok($$insert into public.billing_events (provider, event_id, payload) values ('x', '1', '{}')$$,
  '42501', null, 'usuário não grava eventos de pagamento');

-- Configurações: só uma linha por usuário, com o id do próprio usuário
select throws_ok(
  $$insert into public.user_settings (id, data) values ('a0000000-0000-4000-8000-000000000001', '{}')$$,
  null, null, 'não dá para criar configurações com o id de outra pessoa');

-- ---------------------------------------------------------------- Visitante sem login
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok('select 1 from public.quotes', '42501', null, 'visitante sem login não acessa orçamentos');
select throws_ok('select 1 from public.clients', '42501', null, 'visitante sem login não acessa clientes');
select throws_ok($$select public.buscar_alteracoes()$$, '42501', null, 'visitante não chama a sincronização');

-- ---------------------------------------------------------------- Estrutura
reset role;
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0,
  'todas as tabelas públicas têm RLS ligado');

-- Excluir a conta apaga tudo da pessoa (em cascata)
delete from auth.users where id = 'a0000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::int from public.quotes where user_id = 'a0000000-0000-4000-8000-000000000001')
  + (select count(*)::int from public.clients where user_id = 'a0000000-0000-4000-8000-000000000001')
  + (select count(*)::int from public.user_settings where user_id = 'a0000000-0000-4000-8000-000000000001')
  + (select count(*)::int from public.subscriptions where user_id = 'a0000000-0000-4000-8000-000000000001'),
  0, 'excluir a conta apaga todos os dados do usuário');

select * from finish();
rollback;
