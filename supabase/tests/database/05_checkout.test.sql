-- Reserva de checkout (F8): um checkout por vez por usuário; usuário comum não chama a reserva.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@teste.local', 'authenticated', 'authenticated');

-- Quem chama é a Edge Function, com a chave de serviço
set local role service_role;

create temp table r as select * from public.iniciar_checkout('a0000000-0000-4000-8000-000000000001', 'mensal');
select is((select create_new from r), true, 'primeira chamada reserva e autoriza criar o checkout');
select is((select pending_amount from r), 9.99::numeric, 'reserva guarda o preço vigente');
select isnt((select checkout_token from r), null, 'reserva devolve um token');

-- Segundo clique enquanto o primeiro ainda cria o checkout: não cria outro
select is(
  (select create_new from public.iniciar_checkout('a0000000-0000-4000-8000-000000000001', 'anual')),
  false, 'clique concorrente não cria segundo checkout');

-- Primeiro pedido conclui: grava o ID do checkout pelo token
update public.subscriptions set pending_subscription_id = 'mp-123', pending_checkout_at = null
  where user_id = 'a0000000-0000-4000-8000-000000000001' and pending_checkout_token = (select checkout_token from r);
select is(
  (select pending_subscription_id from public.iniciar_checkout('a0000000-0000-4000-8000-000000000001', 'mensal')),
  'mp-123', 'com checkout pronto, devolve o mesmo ID (mesma URL)');

-- Reserva abandonada (função caiu antes de criar o checkout) expira em 2 minutos
update public.subscriptions set pending_subscription_id = null, pending_checkout_at = now() - interval '3 minutes'
  where user_id = 'a0000000-0000-4000-8000-000000000001';
select is(
  (select create_new from public.iniciar_checkout('a0000000-0000-4000-8000-000000000001', 'mensal')),
  true, 'reserva expirada permite nova tentativa');

select throws_ok($$select * from public.iniciar_checkout(null, 'mensal')$$, '22023', null, 'user_id obrigatório');
select throws_ok($$select * from public.iniciar_checkout('a0000000-0000-4000-8000-000000000001', 'semanal')$$,
  '22023', null, 'período inválido');

-- Usuário comum não pode reservar checkout (nem para outra pessoa)
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok($$select * from public.iniciar_checkout('a0000000-0000-4000-8000-000000000001', 'mensal')$$,
  '42501', null, 'usuário não chama a reserva diretamente');

select * from finish();
rollback;
