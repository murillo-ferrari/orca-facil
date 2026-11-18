-- =============================================================================
-- Edição Cloud — tabelas de dados e regras de acesso (RLS)
-- Ver docs/plano-versao-cloud.md, seção 5.
--
-- Estratégia: cada tabela guarda o objeto completo em `data` (o mesmo formato de src/types.ts) e o
-- servidor extrai só as colunas de que precisa (dono, unicidade, limites, sincronização).
-- Colunas de controle, mantidas pelo servidor:
--   rev          versão da linha (sobe a cada alteração; usada para detectar conflito entre dispositivos)
--   inserted_at  quando a linha foi criada no servidor (base dos limites do plano)
--   updated_at   última alteração no servidor (base da sincronização incremental)
--   deleted_at   exclusão lógica, para os outros dispositivos saberem que algo foi apagado
-- =============================================================================

-- Funções internas ficam fora do schema exposto pela API
create schema if not exists private;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Gatilhos genéricos
-- -----------------------------------------------------------------------------

-- Controle de versão: o servidor define rev e datas; dono, id e data de criação não mudam.
create function private.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Quem cria é sempre o usuário autenticado (sem precisar enviar user_id)
    if auth.uid() is not null then
      new.user_id := auth.uid();
    end if;
    new.rev := 1;
    new.inserted_at := clock_timestamp();
  else
    new.id := old.id;
    new.user_id := old.user_id;
    new.inserted_at := old.inserted_at;
    new.rev := old.rev + 1;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- O documento precisa carregar o mesmo id da linha (evita gravar um registro "dentro" de outro)
create function private.ensure_data_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.data ->> 'id' is distinct from new.id::text then
    raise exception 'data.id (%) difere do id da linha (%)', new.data ->> 'id', new.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

-- Preferências do usuário (unidades de medida etc.). Uma linha por usuário: id = user_id.
create table public.user_settings (
  id          uuid primary key default auth.uid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  rev         integer not null default 1,
  inserted_at timestamptz not null default clock_timestamp(),
  updated_at  timestamptz not null default clock_timestamp(),
  deleted_at  timestamptz,
  constraint user_settings_uma_por_usuario check (id = user_id),
  constraint user_settings_data_objeto check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536)
);

-- Perfis de empresa. `next_number` é a fonte da verdade da numeração (ver reservar_numeros_orcamento).
create table public.company_profiles (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  next_number integer not null default 1 check (next_number >= 1),
  rev         integer not null default 1,
  inserted_at timestamptz not null default clock_timestamp(),
  updated_at  timestamptz not null default clock_timestamp(),
  deleted_at  timestamptz,
  constraint company_profiles_data_objeto check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536)
);

create table public.clients (
  id              uuid primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data            jsonb not null,
  name            text generated always as (data ->> 'name') stored,
  document_digits text generated always as (regexp_replace(coalesce(data ->> 'document', ''), '\D', '', 'g')) stored,
  rev             integer not null default 1,
  inserted_at     timestamptz not null default clock_timestamp(),
  updated_at      timestamptz not null default clock_timestamp(),
  deleted_at      timestamptz,
  constraint clients_data_objeto check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536)
);

create table public.catalog_items (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  description text generated always as (data ->> 'description') stored,
  rev         integer not null default 1,
  inserted_at timestamptz not null default clock_timestamp(),
  updated_at  timestamptz not null default clock_timestamp(),
  deleted_at  timestamptz,
  constraint catalog_items_data_objeto check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536)
);

-- Orçamentos. Sem chave estrangeira para company_profiles: a sincronização pode entregar um orçamento
-- antes da empresa, e a edição Local também não exige o vínculo.
create table public.quotes (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  profile_id  uuid not null,
  number      text not null,
  status      text not null check (status in ('rascunho', 'enviado', 'aprovado', 'recusado')),
  issue_date  date not null,
  rev         integer not null default 1,
  inserted_at timestamptz not null default clock_timestamp(),
  updated_at  timestamptz not null default clock_timestamp(),
  deleted_at  timestamptz,
  constraint quotes_data_objeto check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 262144)
);

-- Índices de sincronização (pull incremental por updated_at) e de regras
create index user_settings_sync_idx on public.user_settings (user_id, updated_at);
create index company_profiles_sync_idx on public.company_profiles (user_id, updated_at);
create index clients_sync_idx on public.clients (user_id, updated_at);
create index catalog_items_sync_idx on public.catalog_items (user_id, updated_at);
create index quotes_sync_idx on public.quotes (user_id, updated_at);
create index quotes_inserted_idx on public.quotes (user_id, inserted_at);
-- Um número de orçamento não se repete na mesma empresa (enquanto não excluído)
create unique index quotes_numero_unico on public.quotes (user_id, profile_id, number) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Gatilhos específicos
-- -----------------------------------------------------------------------------

-- Extrai do documento as colunas usadas pelo servidor, com mensagem clara se vierem inválidas
create function private.quotes_extract_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  begin
    new.profile_id := (new.data ->> 'profileId')::uuid;
    new.issue_date := to_date(new.data ->> 'issueDate', 'YYYY-MM-DD');
  exception when others then
    raise exception 'orçamento com profileId ou issueDate inválido'
      using errcode = 'check_violation';
  end;
  new.number := new.data ->> 'number';
  new.status := new.data ->> 'status';
  return new;
end;
$$;

-- Numeração: só as funções de numeração alteram next_number; o documento sempre reflete o valor real
create function private.company_profiles_next_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.next_number := case
      when (new.data ->> 'nextNumber') ~ '^[0-9]{1,9}$' then greatest(1, (new.data ->> 'nextNumber')::integer)
      else 1
    end;
  elsif coalesce(current_setting('app.permitir_numeracao', true), '') <> 'on' then
    new.next_number := old.next_number;
  end if;
  new.data := jsonb_set(new.data, '{nextNumber}', to_jsonb(new.next_number));
  return new;
end;
$$;

-- Os gatilhos BEFORE disparam em ordem alfabética do nome
create trigger a_touch before insert or update on public.user_settings
  for each row execute function private.touch_row();

create trigger a_touch before insert or update on public.company_profiles
  for each row execute function private.touch_row();
create trigger b_data_id before insert or update on public.company_profiles
  for each row execute function private.ensure_data_id();
create trigger c_next_number before insert or update on public.company_profiles
  for each row execute function private.company_profiles_next_number();

create trigger a_touch before insert or update on public.clients
  for each row execute function private.touch_row();
create trigger b_data_id before insert or update on public.clients
  for each row execute function private.ensure_data_id();

create trigger a_touch before insert or update on public.catalog_items
  for each row execute function private.touch_row();
create trigger b_data_id before insert or update on public.catalog_items
  for each row execute function private.ensure_data_id();

create trigger a_touch before insert or update on public.quotes
  for each row execute function private.touch_row();
create trigger b_data_id before insert or update on public.quotes
  for each row execute function private.ensure_data_id();
create trigger c_extract before insert or update on public.quotes
  for each row execute function private.quotes_extract_columns();

-- -----------------------------------------------------------------------------
-- Acesso: cada usuário só vê e altera as próprias linhas.
-- Não há policy de DELETE: excluir = preencher deleted_at (a exclusão da conta apaga tudo em cascata).
-- As policies de INSERT de orçamentos e empresas (limites do plano) ficam na migração de planos.
-- -----------------------------------------------------------------------------

alter table public.user_settings enable row level security;
alter table public.company_profiles enable row level security;
alter table public.clients enable row level security;
alter table public.catalog_items enable row level security;
alter table public.quotes enable row level security;

create policy "dono lê" on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "dono cria" on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "dono lê" on public.company_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "dono altera" on public.company_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "dono lê" on public.clients for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "dono cria" on public.clients for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.clients for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "dono lê" on public.catalog_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "dono cria" on public.catalog_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.catalog_items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "dono lê" on public.quotes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "dono altera" on public.quotes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Visitantes sem login não acessam nada; usuários não apagam fisicamente
revoke all on public.user_settings, public.company_profiles, public.clients, public.catalog_items, public.quotes
  from anon;
revoke delete, truncate on public.user_settings, public.company_profiles, public.clients, public.catalog_items,
  public.quotes from authenticated;

-- Funções de gatilho não são chamáveis diretamente
revoke all on function private.touch_row(), private.ensure_data_id(), private.quotes_extract_columns(),
  private.company_profiles_next_number() from public;
