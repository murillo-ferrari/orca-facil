-- =============================================================================
-- Edição Cloud só com o plano Pro (decisão de 26/11/2026)
--
-- O "grátis" é a edição Local (sem conta, dados no navegador). Na nuvem só ESCREVE quem tem plano Pro vigente
-- (inclui os 7 dias de tolerância de private.current_plan()). Sem plano (conta nova ou assinatura vencida) a conta
-- só LÊ os próprios dados: dá para exportar um backup, assinar de novo ou excluir a conta, e nada é apagado.
--
-- Substitui os limites do plano grátis (15 orçamentos por mês, 1 empresa) e a importação sem limite
-- (`importar_dados`), que só existia para furar esses limites. `subscriptions.plan = 'free'` passa a significar
-- "sem assinatura".
-- =============================================================================

create function private.is_pro()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.current_plan() = 'pro';
$$;

revoke all on function private.is_pro() from public;
grant execute on function private.is_pro() to authenticated;

-- Escrita nas cinco tabelas exige Pro. O WITH CHECK (e não o USING) faz o UPDATE de quem não é Pro falhar com
-- erro 42501 ("sem_permissao"), em vez de não achar a linha e parecer um conflito de sincronização.
do $$
declare
  t text;
begin
  foreach t in array array['user_settings', 'company_profiles', 'clients', 'catalog_items', 'quotes'] loop
    execute format('drop policy if exists "dono cria" on public.%I', t);
    execute format('drop policy if exists "dono cria (respeitando o plano)" on public.%I', t);
    execute format('drop policy if exists "dono altera" on public.%I', t);
    execute format(
      'create policy "dono cria (Pro)" on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id and private.is_pro())', t);
    execute format(
      'create policy "dono altera (Pro)" on public.%I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id and private.is_pro())', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Fim dos limites e da importação sem limite
-- -----------------------------------------------------------------------------
drop function public.importar_dados(jsonb);
drop function public.uso_do_plano();
drop trigger d_imported on public.quotes;
drop function private.quotes_imported_guard();
alter table public.quotes drop column imported;
drop function private.can_create_quote();
drop function private.can_create_company_profile();
drop function private.quotes_created_this_month();

-- `plan_limits` só guardava os limites; o plano passa a ser validado direto na assinatura
alter table public.subscriptions drop constraint subscriptions_plan_fkey;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('free', 'pro'));
drop table public.plan_limits;

-- aplicar_alteracoes sem as checagens de limite (a RLS acima já recusa quem não é Pro, como 'sem_permissao')
create or replace function public.aplicar_alteracoes(p_changes jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  c         jsonb;
  t         text;
  v_id      uuid;
  v_base    integer;
  v_deleted boolean;
  v_data    jsonb;
  v_rev     integer;
  v_updated timestamptz;
  v_exists  boolean;
  v_count   integer;
  v_server  jsonb;
  v_applied   jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  v_rejected  jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'não autenticado' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'o lote deve ser um array' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_array_length(p_changes) > 500 then
    raise exception 'lote com mais de 500 itens' using errcode = 'program_limit_exceeded';
  end if;

  for c in select value from jsonb_array_elements(p_changes) loop
    t := c ->> 'table';
    begin
      if t is null or t not in ('user_settings', 'company_profiles', 'clients', 'catalog_items', 'quotes') then
        raise exception 'tabela não sincronizável: %', coalesce(t, '(vazia)') using errcode = 'invalid_parameter_value';
      end if;
      v_id := (c ->> 'id')::uuid;
      v_base := (c ->> 'base_rev')::integer;
      v_deleted := coalesce((c ->> 'deleted')::boolean, false);
      v_data := c -> 'data';

      if v_base is null then
        -- Registro novo. Se o id já existe, é conflito (outro dispositivo criou antes).
        execute format('select exists (select 1 from public.%I where id = $1)', t) into v_exists using v_id;
        if not v_exists then
          execute format(
            'insert into public.%I (id, data, deleted_at) values ($1, $2, case when $3 then clock_timestamp() end)
             on conflict (id) do nothing
             returning rev, updated_at', t)
            into v_rev, v_updated using v_id, v_data, v_deleted;
          get diagnostics v_count = row_count;
        else
          v_count := 0;
        end if;
      else
        execute format(
          'update public.%I
              set data = coalesce($2, data),
                  deleted_at = case when $3 then coalesce(deleted_at, clock_timestamp()) end
            where id = $1 and rev = $4
           returning rev, updated_at', t)
          into v_rev, v_updated using v_id, v_data, v_deleted, v_base;
        get diagnostics v_count = row_count;
      end if;

      if v_count = 1 then
        v_applied := v_applied || jsonb_build_object('table', t, 'id', v_id, 'rev', v_rev, 'updated_at', v_updated);
      else
        execute format('select to_jsonb(x) from public.%I x where x.id = $1', t) into v_server using v_id;
        v_conflicts := v_conflicts || jsonb_build_object('table', t, 'id', v_id, 'server', v_server);
      end if;
    exception when others then
      v_rejected := v_rejected || jsonb_build_object(
        'table', t,
        'id', c ->> 'id',
        'reason', case
          when sqlstate = '42501' then 'sem_permissao'
          when sqlstate = '23505' then 'duplicado'
          when sqlstate in ('23514', '23502', '22P02', '22007', '22008', '22023') then 'dados_invalidos'
          else 'erro'
        end,
        'message', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('applied', v_applied, 'conflicts', v_conflicts, 'rejected', v_rejected);
end;
$$;
