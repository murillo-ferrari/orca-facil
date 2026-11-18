-- Integridade: versão das linhas, colunas extraídas do documento e validações.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@teste.local', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

insert into public.company_profiles (id, data) values
  ('a1000000-0000-4000-8000-000000000001', '{"id": "a1000000-0000-4000-8000-000000000001", "label": "Empresa", "nextNumber": 41}');

-- ---------------------------------------------------------------- Versão da linha
insert into public.clients (id, data) values
  ('a2000000-0000-4000-8000-000000000001', '{"id": "a2000000-0000-4000-8000-000000000001", "name": "Maria", "document": "529.982.247-25"}');
select is((select rev from public.clients), 1, 'registro novo começa na versão 1');

update public.clients set data = data || '{"phone": "(11) 91234-5678"}';
update public.clients set data = data || '{"email": "maria@teste.local"}';
select is((select rev from public.clients), 3, 'cada alteração sobe a versão');

update public.clients set rev = 99, inserted_at = '2000-01-01';
select is((select rev from public.clients), 4, 'o app não consegue forjar a versão');
select isnt((select inserted_at from public.clients), '2000-01-01'::timestamptz, 'nem a data de criação');

select is((select name from public.clients), 'Maria', 'nome extraído do documento');
select is((select document_digits from public.clients), '52998224725', 'documento extraído só com dígitos');

-- ---------------------------------------------------------------- Documento coerente com a linha
select throws_ok(
  $$insert into public.clients (id, data) values ('a2000000-0000-4000-8000-000000000002', '{"id": "outro-id", "name": "X"}')$$,
  '23514', null, 'data.id diferente do id da linha é recusado');
select throws_ok(
  $$insert into public.clients (id, data) values ('a2000000-0000-4000-8000-000000000003', '[1, 2, 3]')$$,
  '23514', null, 'documento precisa ser um objeto JSON');

-- ---------------------------------------------------------------- Orçamentos
insert into public.quotes (id, data) values
  ('a4000000-0000-4000-8000-000000000001', '{"id": "a4000000-0000-4000-8000-000000000001", "profileId": "a1000000-0000-4000-8000-000000000001", "number": "ORC-0041", "status": "enviado", "issueDate": "2026-11-18"}');

select results_eq(
  'select profile_id::text, number, status, issue_date from public.quotes',
  $$values ('a1000000-0000-4000-8000-000000000001', 'ORC-0041', 'enviado', '2026-11-18'::date)$$,
  'colunas do orçamento extraídas do documento');

update public.quotes set data = data || '{"status": "aprovado"}';
select is((select status from public.quotes), 'aprovado', 'colunas acompanham alterações do documento');

select throws_ok(
  $$insert into public.quotes (id, data) values ('a4000000-0000-4000-8000-000000000002',
    '{"id": "a4000000-0000-4000-8000-000000000002", "profileId": "a1000000-0000-4000-8000-000000000001", "number": "ORC-0042", "status": "pago", "issueDate": "2026-11-18"}')$$,
  '23514', null, 'status fora da lista é recusado');
select throws_ok(
  $$insert into public.quotes (id, data) values ('a4000000-0000-4000-8000-000000000003',
    '{"id": "a4000000-0000-4000-8000-000000000003", "profileId": "a1000000-0000-4000-8000-000000000001", "number": "ORC-0043", "status": "rascunho", "issueDate": "18/11/2026"}')$$,
  '23514', null, 'data de emissão fora do formato yyyy-MM-dd é recusada');
select throws_ok(
  $$insert into public.quotes (id, data) values ('a4000000-0000-4000-8000-000000000004',
    '{"id": "a4000000-0000-4000-8000-000000000004", "profileId": "a1000000-0000-4000-8000-000000000001", "number": "ORC-0041", "status": "rascunho", "issueDate": "2026-11-18"}')$$,
  '23505', null, 'número repetido na mesma empresa é recusado');

-- Número de orçamento excluído pode ser reutilizado
update public.quotes set deleted_at = now();
select lives_ok(
  $$insert into public.quotes (id, data) values ('a4000000-0000-4000-8000-000000000005',
    '{"id": "a4000000-0000-4000-8000-000000000005", "profileId": "a1000000-0000-4000-8000-000000000001", "number": "ORC-0041", "status": "rascunho", "issueDate": "2026-11-18"}')$$,
  'número de orçamento excluído pode ser usado de novo');

-- ---------------------------------------------------------------- Numeração protegida
select is((select next_number from public.company_profiles), 41, 'próximo número inicial vem do documento');

update public.company_profiles set next_number = 1, data = data || '{"nextNumber": 1, "label": "Renomeada"}';
select is((select next_number from public.company_profiles), 41,
  'alteração comum não mexe na numeração (só pelas funções de numeração)');
select is((select data ->> 'nextNumber' from public.company_profiles), '41',
  'o documento sempre reflete o próximo número real');

select * from finish();
rollback;
