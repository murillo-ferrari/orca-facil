-- Importação: não conta no limite do plano e só vale para contas sem orçamentos próprios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('c0000000-0000-4000-8000-000000000001', 'ana@teste.local', 'authenticated', 'authenticated');

-- Lote de importação: 2 empresas (o grátis permite 1) e 20 orçamentos (o grátis permite 15 por mês)
create temp table lote as
select jsonb_agg(c) as changes from (
  select jsonb_build_object('table', 'company_profiles', 'id', p.id, 'base_rev', null,
           'data', jsonb_build_object('id', p.id, 'label', 'Empresa ' || p.n)) as c
  from (select ('c1000000-0000-4000-8000-00000000000' || n)::uuid as id, n from generate_series(1, 2) n) p
  union all
  select jsonb_build_object('table', 'quotes', 'id', q.id, 'base_rev', null,
           'data', jsonb_build_object('id', q.id, 'profileId', 'c1000000-0000-4000-8000-000000000001',
             'number', 'ORC-' || lpad(q.n::text, 4, '0'), 'status', 'rascunho', 'issueDate', '2026-11-18'))
  from (select gen_random_uuid() as id, n from generate_series(1, 20) n) q
) todos;
grant select on lote to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

create temp table resultado as select public.importar_dados((select changes from lote)) as r;

select is((select count(*)::int from public.company_profiles), 2,
  'importação: 2 empresas, acima do limite do grátis, são aceitas');
select is((select count(*)::int from public.quotes), 20,
  'importação: 20 orçamentos, acima do limite do grátis, são aceitos');
select is((select jsonb_array_length(r -> 'rejected') from resultado), 0, 'importação: nada foi recusado');
select is((select (public.uso_do_plano() ->> 'orcamentos_no_mes')::int), 0,
  'orçamentos importados não contam no limite do mês');

-- Um insert direto nunca nasce como importado, mesmo pedindo
insert into public.quotes (id, data, imported) values
  ('c4000000-0000-4000-8000-000000000001',
   '{"id": "c4000000-0000-4000-8000-000000000001", "profileId": "c1000000-0000-4000-8000-000000000001", "number": "ORC-1000", "status": "rascunho", "issueDate": "2026-11-18"}',
   true);
select is((select imported from public.quotes where id = 'c4000000-0000-4000-8000-000000000001'), false,
  'insert direto não consegue marcar o orçamento como importado');

-- E um update não muda a marca
update public.quotes set imported = true where id = 'c4000000-0000-4000-8000-000000000001';
select is((select imported from public.quotes where id = 'c4000000-0000-4000-8000-000000000001'), false,
  'update não consegue marcar o orçamento como importado');

-- Depois da importação o limite volta a valer para orçamentos novos (já há 1 próprio; cabem mais 14)
do $$
declare
  i int;
  v_id uuid;
begin
  for i in 1..14 loop
    v_id := gen_random_uuid();
    insert into public.quotes (id, data) values (v_id, jsonb_build_object(
      'id', v_id, 'profileId', 'c1000000-0000-4000-8000-000000000001',
      'number', 'ORC-' || lpad((1000 + i)::text, 4, '0'), 'status', 'rascunho', 'issueDate', '2026-11-18'));
  end loop;
end $$;
select is((select (public.uso_do_plano() ->> 'orcamentos_no_mes')::int), 15,
  'depois da importação, os orçamentos próprios contam: 15 no mês');

select throws_ok(
  $$insert into public.quotes (id, data) values ('c4000000-0000-4000-8000-000000000099',
    '{"id": "c4000000-0000-4000-8000-000000000099", "profileId": "c1000000-0000-4000-8000-000000000001", "number": "ORC-2000", "status": "rascunho", "issueDate": "2026-11-18"}')$$,
  '42501', null, 'depois da importação, o 16º orçamento próprio do mês é bloqueado');

-- Com orçamento próprio, a conta não importa mais (a exceção não vira atalho)
select throws_ok($$select public.importar_dados('[]'::jsonb)$$, 'P0001', null,
  'importação é recusada em conta que já tem orçamentos próprios');

select * from finish();
rollback;
