-- Sincronização entre dispositivos e numeração de orçamentos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@teste.local', 'authenticated', 'authenticated'),
  ('b0000000-0000-4000-8000-000000000002', 'bia@teste.local', 'authenticated', 'authenticated');

-- Documento de orçamento mínimo
create function pg_temp.orcamento(p_id uuid, p_numero text, p_status text default 'rascunho')
returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'profileId', 'a1000000-0000-4000-8000-000000000001',
    'number', p_numero, 'status', p_status, 'issueDate', '2026-11-18')
$$;
grant execute on function pg_temp.orcamento(uuid, text, text) to authenticated;

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- ---------------------------------------------------------------- aplicar_alteracoes: criação
insert into r values ('lote1', public.aplicar_alteracoes(jsonb_build_array(
  jsonb_build_object('table', 'company_profiles', 'id', 'a1000000-0000-4000-8000-000000000001', 'base_rev', null,
    'data', '{"id": "a1000000-0000-4000-8000-000000000001", "label": "Empresa", "nextNumber": 41}'::jsonb),
  jsonb_build_object('table', 'quotes', 'id', 'a4000000-0000-4000-8000-000000000001', 'base_rev', null,
    'data', pg_temp.orcamento('a4000000-0000-4000-8000-000000000001', 'ORC-0041'))
)));
select is(jsonb_array_length((select v from r where k = 'lote1') -> 'applied'), 2, 'lote novo: dois registros aplicados');
select is(((select v from r where k = 'lote1') -> 'applied' -> 1 ->> 'rev')::int, 1, 'devolve a versão criada (1)');

-- ---------------------------------------------------------------- alteração com a versão certa
insert into r values ('lote2', public.aplicar_alteracoes(jsonb_build_array(jsonb_build_object(
  'table', 'quotes', 'id', 'a4000000-0000-4000-8000-000000000001', 'base_rev', 1,
  'data', pg_temp.orcamento('a4000000-0000-4000-8000-000000000001', 'ORC-0041', 'enviado')))));
select is(((select v from r where k = 'lote2') -> 'applied' -> 0 ->> 'rev')::int, 2, 'alteração com versão certa é aplicada (rev 2)');
select is((select status from public.quotes), 'enviado', 'o servidor reflete a alteração');

-- ---------------------------------------------------------------- conflito: outro dispositivo alterou antes
insert into r values ('lote3', public.aplicar_alteracoes(jsonb_build_array(jsonb_build_object(
  'table', 'quotes', 'id', 'a4000000-0000-4000-8000-000000000001', 'base_rev', 1,
  'data', pg_temp.orcamento('a4000000-0000-4000-8000-000000000001', 'ORC-0041', 'recusado')))));
select is(jsonb_array_length((select v from r where k = 'lote3') -> 'applied'), 0, 'versão desatualizada não é aplicada');
select is(((select v from r where k = 'lote3') -> 'conflicts' -> 0 -> 'server' ->> 'rev')::int, 2,
  'conflito devolve a versão atual do servidor');
select is((select status from public.quotes), 'enviado', 'conflito não altera o servidor');

-- Criar de novo um id que já existe também é conflito
insert into r values ('lote4', public.aplicar_alteracoes(jsonb_build_array(jsonb_build_object(
  'table', 'quotes', 'id', 'a4000000-0000-4000-8000-000000000001', 'base_rev', null,
  'data', pg_temp.orcamento('a4000000-0000-4000-8000-000000000001', 'ORC-0041')))));
select is(jsonb_array_length((select v from r where k = 'lote4') -> 'conflicts'), 1, 'criar id existente vira conflito');

-- ---------------------------------------------------------------- exclusão lógica e restauração
insert into r values ('lote5', public.aplicar_alteracoes(jsonb_build_array(jsonb_build_object(
  'table', 'quotes', 'id', 'a4000000-0000-4000-8000-000000000001', 'base_rev', 2, 'deleted', true))));
select isnt((select deleted_at from public.quotes), null, 'exclusão preenche deleted_at');
select is((select data ->> 'number' from public.quotes), 'ORC-0041', 'excluir sem enviar data mantém o documento');

insert into r values ('lote6', public.aplicar_alteracoes(jsonb_build_array(jsonb_build_object(
  'table', 'quotes', 'id', 'a4000000-0000-4000-8000-000000000001', 'base_rev', 3, 'deleted', false))));
select is((select deleted_at from public.quotes), null, 'restaurar limpa deleted_at');

-- ---------------------------------------------------------------- itens independentes no lote
insert into r values ('lote7', public.aplicar_alteracoes(jsonb_build_array(
  jsonb_build_object('table', 'quotes', 'id', 'a4000000-0000-4000-8000-000000000002', 'base_rev', null,
    'data', pg_temp.orcamento('a4000000-0000-4000-8000-000000000002', 'ORC-0042', 'pago')),
  jsonb_build_object('table', 'usuarios', 'id', 'a4000000-0000-4000-8000-000000000009', 'base_rev', null, 'data', '{}'::jsonb),
  jsonb_build_object('table', 'quotes', 'id', 'a4000000-0000-4000-8000-000000000003', 'base_rev', null,
    'data', pg_temp.orcamento('a4000000-0000-4000-8000-000000000003', 'ORC-0043'))
)));
select is(jsonb_array_length((select v from r where k = 'lote7') -> 'applied'), 1, 'item válido é aplicado mesmo com outros inválidos');
select is((select v from r where k = 'lote7') -> 'rejected' -> 0 ->> 'reason', 'dados_invalidos', 'status inválido é rejeitado como dados_invalidos');
select is((select v from r where k = 'lote7') -> 'rejected' -> 1 ->> 'reason', 'dados_invalidos', 'tabela desconhecida é rejeitada');

-- Limite do plano aparece como motivo claro (grátis: 1 empresa)
insert into r values ('lote8', public.aplicar_alteracoes(jsonb_build_array(jsonb_build_object(
  'table', 'company_profiles', 'id', 'a1000000-0000-4000-8000-000000000002', 'base_rev', null,
  'data', '{"id": "a1000000-0000-4000-8000-000000000002", "label": "Segunda"}'::jsonb))));
select is((select v from r where k = 'lote8') -> 'rejected' -> 0 ->> 'reason', 'limite_do_plano', 'limite do plano tem motivo próprio');

select throws_ok(
  $$select public.aplicar_alteracoes((select jsonb_agg(jsonb_build_object('table', 'clients')) from generate_series(1, 501)))$$,
  '54000', null, 'lote com mais de 500 itens é recusado');

-- ---------------------------------------------------------------- buscar_alteracoes
insert into r values ('pull1', public.buscar_alteracoes());
select is(jsonb_array_length((select v from r where k = 'pull1') -> 'quotes' -> 'rows'), 2, 'busca completa traz os orçamentos');
select is(jsonb_array_length((select v from r where k = 'pull1') -> 'user_settings' -> 'rows'), 1, 'e as configurações do usuário');
select is(((select v from r where k = 'pull1') -> 'quotes' ->> 'has_more')::boolean, false, 'sem mais páginas');

insert into r values ('pull2', public.buscar_alteracoes(p_limite => 1));
select is(((select v from r where k = 'pull2') -> 'quotes' ->> 'has_more')::boolean, true, 'paginação indica que há mais');

insert into r values ('pull3', public.buscar_alteracoes(clock_timestamp()));
select is(jsonb_array_length((select v from r where k = 'pull3') -> 'quotes' -> 'rows'), 0, 'nada novo desde agora');

-- ---------------------------------------------------------------- numeração
select is(public.reservar_numeros_orcamento('a1000000-0000-4000-8000-000000000001', 3), 41, 'reserva devolve o primeiro do bloco');
select is(public.reservar_numeros_orcamento('a1000000-0000-4000-8000-000000000001'), 44, 'a próxima reserva continua de onde parou');
select is((select data ->> 'nextNumber' from public.company_profiles), '45', 'o documento da empresa acompanha (outros dispositivos recebem)');
select is(public.definir_proximo_numero('a1000000-0000-4000-8000-000000000001', 100), 100, 'próximo número pode ser definido');

-- Outra pessoa não reserva números na empresa da Ana nem a enxerga nos conflitos
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok($$select public.reservar_numeros_orcamento('a1000000-0000-4000-8000-000000000001')$$,
  'P0002', null, 'não reserva números na empresa de outra pessoa');
insert into r values ('lote9', public.aplicar_alteracoes(jsonb_build_array(jsonb_build_object(
  'table', 'quotes', 'id', 'a4000000-0000-4000-8000-000000000001', 'base_rev', 4,
  'data', pg_temp.orcamento('a4000000-0000-4000-8000-000000000001', 'ORC-0041', 'recusado')))));
select is((select v from r where k = 'lote9') -> 'conflicts' -> 0 -> 'server', 'null'::jsonb,
  'alterar registro de outra pessoa falha sem revelar o conteúdo');

select * from finish();
rollback;
