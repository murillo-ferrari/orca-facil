-- =============================================================================
-- Edição Cloud — sincronização entre dispositivos e numeração de orçamentos
-- Ver docs/plano-versao-cloud.md, seção 7.
--
-- Contrato com o app:
--   aplicar_alteracoes(lote)    envia a fila de alterações do dispositivo (insert/update/exclusão lógica)
--   buscar_alteracoes(desde)    traz tudo que mudou no servidor desde o último cursor
--   reservar_numeros_orcamento  reserva um bloco de números para o dispositivo usar mesmo offline
--   definir_proximo_numero      campo "Próximo número" da tela de empresa
-- Todas rodam como o usuário autenticado (security invoker): as regras de acesso (RLS) valem.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- aplicar_alteracoes
--
-- Entrada: array de até 500 itens
--   { "table": "quotes", "id": "<uuid>", "data": {...}, "base_rev": 3 | null, "deleted": false }
--   base_rev null  → registro novo (insert)
--   base_rev N     → altera só se a versão no servidor ainda for N (senão: conflito)
--   deleted true   → exclusão lógica (preenche deleted_at); false restaura
-- Saída:
--   { "applied":   [{ table, id, rev, updated_at }],
--     "conflicts": [{ table, id, server: <linha atual no servidor ou null> }],
--     "rejected":  [{ table, id, reason, message }] }
-- Cada item é independente: um item rejeitado não desfaz os demais.
-- -----------------------------------------------------------------------------
create function public.aplicar_alteracoes(p_changes jsonb)
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
          if t = 'quotes' and not private.can_create_quote() then
            raise exception 'limite de orçamentos do plano atingido' using errcode = 'P0001', hint = 'limite_do_plano';
          end if;
          if t = 'company_profiles' and not private.can_create_company_profile() then
            raise exception 'limite de empresas do plano atingido' using errcode = 'P0001', hint = 'limite_do_plano';
          end if;
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
          when sqlstate = 'P0001' and sqlerrm like 'limite %' then 'limite_do_plano'
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

-- -----------------------------------------------------------------------------
-- buscar_alteracoes
--
-- Traz, por tabela, até p_limite linhas alteradas depois de p_desde (inclui excluídas, para o
-- dispositivo apagar a cópia local). O app guarda o maior updated_at recebido de cada tabela como
-- cursor e repete enquanto has_more = true. Recomenda-se pedir com ~10 s de sobreposição.
-- -----------------------------------------------------------------------------
create function public.buscar_alteracoes(p_desde timestamptz default '-infinity', p_limite integer default 500)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  t      text;
  v_rows jsonb;
  v_out  jsonb;
begin
  if auth.uid() is null then
    raise exception 'não autenticado' using errcode = 'insufficient_privilege';
  end if;
  p_limite := least(greatest(coalesce(p_limite, 500), 1), 1000);
  v_out := jsonb_build_object('server_time', now());
  foreach t in array array['user_settings', 'company_profiles', 'clients', 'catalog_items', 'quotes'] loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at), ''[]''::jsonb)
         from (select * from public.%I where updated_at > $1 order by updated_at limit $2) x', t)
      into v_rows using p_desde, p_limite;
    v_out := v_out || jsonb_build_object(t, jsonb_build_object(
      'rows', v_rows,
      'has_more', jsonb_array_length(v_rows) = p_limite));
  end loop;
  return v_out;
end;
$$;

-- -----------------------------------------------------------------------------
-- Numeração de orçamentos
-- -----------------------------------------------------------------------------

-- Reserva p_quantidade números seguidos e devolve o primeiro. Atômico: duas chamadas simultâneas
-- (dois dispositivos) nunca recebem o mesmo número, porque o UPDATE trava a linha da empresa.
create function public.reservar_numeros_orcamento(p_empresa uuid, p_quantidade integer default 1)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_primeiro integer;
begin
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 50 then
    raise exception 'quantidade deve estar entre 1 e 50' using errcode = 'invalid_parameter_value';
  end if;
  perform set_config('app.permitir_numeracao', 'on', true);
  update public.company_profiles
     set next_number = next_number + p_quantidade
   where id = p_empresa and deleted_at is null
  returning next_number - p_quantidade into v_primeiro;
  perform set_config('app.permitir_numeracao', 'off', true);
  if v_primeiro is null then
    raise exception 'empresa não encontrada' using errcode = 'no_data_found';
  end if;
  return v_primeiro;
end;
$$;

-- Campo "Próximo número" da tela de empresa
create function public.definir_proximo_numero(p_empresa uuid, p_proximo integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_novo integer;
begin
  if p_proximo is null or p_proximo < 1 then
    raise exception 'o próximo número deve ser maior que zero' using errcode = 'invalid_parameter_value';
  end if;
  perform set_config('app.permitir_numeracao', 'on', true);
  update public.company_profiles
     set next_number = p_proximo
   where id = p_empresa and deleted_at is null
  returning next_number into v_novo;
  perform set_config('app.permitir_numeracao', 'off', true);
  if v_novo is null then
    raise exception 'empresa não encontrada' using errcode = 'no_data_found';
  end if;
  return v_novo;
end;
$$;

revoke all on function public.aplicar_alteracoes(jsonb), public.buscar_alteracoes(timestamptz, integer),
  public.reservar_numeros_orcamento(uuid, integer), public.definir_proximo_numero(uuid, integer) from public, anon;
grant execute on function public.aplicar_alteracoes(jsonb), public.buscar_alteracoes(timestamptz, integer),
  public.reservar_numeros_orcamento(uuid, integer), public.definir_proximo_numero(uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Tempo real: avisa os outros dispositivos de que algo mudou (o app então chama buscar_alteracoes).
-- As regras de acesso valem também aqui: cada usuário só recebe avisos das próprias linhas.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.user_settings, public.company_profiles, public.clients, public.catalog_items, public.quotes,
  public.subscriptions;

-- -----------------------------------------------------------------------------
-- Limpeza: linhas excluídas há mais de 90 dias são removidas de vez (todo dia às 3h30, horário UTC).
-- Dispositivos que ficarem mais de 90 dias sem sincronizar precisam de uma sincronização completa.
-- -----------------------------------------------------------------------------
create function private.purge_deleted_rows()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.quotes where deleted_at < now() - interval '90 days';
  delete from public.clients where deleted_at < now() - interval '90 days';
  delete from public.catalog_items where deleted_at < now() - interval '90 days';
  delete from public.company_profiles where deleted_at < now() - interval '90 days';
end;
$$;

revoke all on function private.purge_deleted_rows() from public;

create extension if not exists pg_cron;
select cron.schedule('limpar-registros-excluidos', '30 3 * * *', 'select private.purge_deleted_rows()');
