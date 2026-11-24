-- =============================================================================
-- Importação de dados da edição Local (plano, seção 8)
--
-- Quem usa a edição Local grátis e assina a Cloud leva o histórico para a nuvem. O plano promete que a importação
-- não pune quem migra: os orçamentos importados não entram na contagem mensal do plano grátis, e a importação
-- aceita mais empresas do que o limite (que vale para criar novas).
--
-- Como isso não vira atalho para burlar o plano:
--   * só a função `importar_dados` liga a exceção (variável de transação `app.importando`, a mesma ideia de
--     `app.permitir_numeracao`); o usuário não consegue ligá-la pela API;
--   * a função só funciona enquanto a conta não tem orçamento próprio (criado fora de uma importação);
--   * há um teto de 5.000 orçamentos e 20 empresas por conta via importação;
--   * a coluna `quotes.imported` é definida pelo servidor: um insert direto nunca nasce importado e um update não a muda.
-- =============================================================================

alter table public.quotes add column imported boolean not null default false;

-- Marca como importado só o que nasce dentro de `importar_dados`; o resto é sempre falso
create function private.quotes_imported_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.imported := coalesce(current_setting('app.importando', true), '') = 'on';
  else
    new.imported := old.imported;
  end if;
  return new;
end;
$$;

revoke all on function private.quotes_imported_guard() from public;

create trigger d_imported before insert or update on public.quotes
  for each row execute function private.quotes_imported_guard();

-- Contagem mensal sem os importados (continua contando os excluídos, para apagar e recriar não devolver cota)
create or replace function private.quotes_created_this_month()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.quotes q
  where q.user_id = auth.uid()
    and not q.imported
    and q.inserted_at >= (date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
$$;

-- Durante a importação, os limites de criação não valem
create or replace function private.can_create_quote()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(current_setting('app.importando', true), '') = 'on'
      or coalesce((
        select l.max_new_quotes_per_month is null
            or private.quotes_created_this_month() < l.max_new_quotes_per_month
        from public.plan_limits l
        where l.plan = private.current_plan()
      ), false);
$$;

create or replace function private.can_create_company_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(current_setting('app.importando', true), '') = 'on'
      or coalesce((
        select l.max_company_profiles is null
            or (select count(*) from public.company_profiles p
                where p.user_id = auth.uid() and p.deleted_at is null) < l.max_company_profiles
        from public.plan_limits l
        where l.plan = private.current_plan()
      ), false);
$$;

-- Mesmo formato de entrada e de saída de `aplicar_alteracoes`; roda com as permissões de quem chama (a RLS vale)
create function public.importar_dados(p_changes jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_res      jsonb;
  v_quotes   integer;
  v_profiles integer;
begin
  if auth.uid() is null then
    raise exception 'não autenticado' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'o lote deve ser um array' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from public.quotes q where not q.imported) then
    raise exception 'a conta já tem orçamentos próprios' using errcode = 'P0001', hint = 'conta_com_dados';
  end if;

  select count(*) into v_quotes from jsonb_array_elements(p_changes) c where c ->> 'table' = 'quotes';
  select count(*) into v_profiles from jsonb_array_elements(p_changes) c where c ->> 'table' = 'company_profiles';
  if (select count(*) from public.quotes) + v_quotes > 5000
     or (select count(*) from public.company_profiles) + v_profiles > 20 then
    raise exception 'importação acima do limite' using errcode = 'P0001', hint = 'limite_da_importacao';
  end if;

  perform set_config('app.importando', 'on', true);
  v_res := public.aplicar_alteracoes(p_changes);
  perform set_config('app.importando', 'off', true);
  return v_res;
end;
$$;

revoke all on function public.importar_dados(jsonb) from public, anon;
grant execute on function public.importar_dados(jsonb) to authenticated;
