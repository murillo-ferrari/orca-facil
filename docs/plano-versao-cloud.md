# Plano de implementação — Orçafácil Cloud

> Documento de planejamento. Estado do projeto na data: app 100% local (React + `localStorage`), schema de dados v2,
> sem remoto Git. Valores de preços e limites de terceiros foram verificados em novembro de 2026 e devem ser
> reconferidos antes de contratar (fontes no fim do documento).

> **Decidido:** backend **Supabase** e autenticação **Supabase Auth**. O Clerk foi descartado porque a cobrança dele
> (Clerk Billing) não funciona no Brasil, e sem ela não compensava um segundo fornecedor. Comparativo e justificativa
> em [avaliação de autenticação e backend](avaliacao-autenticacao-e-backend.md).

## 1. Objetivo

O projeto passa a ter duas edições, a partir do **mesmo código**:

| | **Edição Local** (etapa 1) | **Edição Cloud** (etapa 2) |
|---|---|---|
| Onde roda | GitHub Pages, ou onde a pessoa quiser (clone + build) | Domínio próprio (`orcafacil.murilloferrari.tech`) |
| Conta | Não precisa | Login obrigatório (Supabase Auth) |
| Dados | `localStorage` do navegador | Banco na nuvem (Supabase/Postgres) + cópia local para uso offline |
| Diferencial | Grátis, código aberto, privado por padrão | Mesmos dados em qualquer dispositivo; backup automático |
| Custo para o usuário | Grátis | Plano grátis com limite + plano pago |

A edição Local continua existindo e completa. A Cloud acrescenta conta, sincronização e planos, e não pode piorar
a experiência atual: o app continua rápido e funciona sem internet.

## 2. Decisões que dependem de você

Decididas em 18/11/2026: **D1, D2 e D3**, além de backend e autenticação (Supabase + Supabase Auth). As demais têm
recomendação e podem ser definidas até a fase indicada na seção 17.

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| D1 | **Licença** do repositório público | MIT · AGPL-3.0 | ✅ **AGPL-3.0** — quem hospedar uma versão modificada do app como serviço precisa publicar o código |
| D2 | **Código da Cloud** no mesmo repositório público? | Mesmo repo · repo privado separado | ✅ **Mesmo repositório**, com as edições escolhidas por variável de build; segredos fora do código |
| D3 | **Domínio** | — | ✅ **`orcafacil.murilloferrari.tech`** (subdomínio no Cloudflare; trocado em 23/11/2026 no lugar de `orcafacil.com.br`). App nesse endereço, e-mails de login de `login@orcafacil.murilloferrari.tech` |
| D4 | **Provedor de pagamento** | Asaas · Mercado Pago · Stripe · Paddle (detalhes na seção 9.2) | **Asaas** se você tiver CNPJ (Pix, boleto, cartão e emissão de NFS-e); **Paddle** se quiser que outra empresa fature e cuide dos impostos |
| D5 | **Planos e limites** | Ver seção 9.1 | Grátis com limite de volume; Pro sem limites |
| D6 | **Formas de login** | E-mail com código · Google · Apple · senha | **E-mail com código de 6 dígitos + Google** (sem senha para esquecer) |
| D10 | **Serviço de envio de e-mail (SMTP)** | Resend · Brevo · Amazon SES · Postmark · ZeptoMail | ✅ **Resend** (decidido em 23/11/2026) |
| D7 | **Nível de offline** | Só online · leitura offline · leitura e escrita offline | **Leitura e escrita offline**: o público trabalha na casa do cliente, muitas vezes sem sinal |
| D8 | **Conflito** entre dispositivos | Última gravação vence · diálogo de escolha · mesclar | **Última gravação vence**, guardando a versão perdida para restaurar (seção 7.5) |
| D9 | **Nome do produto** | — | **Orçafácil**, acompanhando o domínio; confirmar quando o registro for concluído |

## 3. Etapa 1 — Publicação da edição Local (pré-requisito)

Rápida e independente. Dá visibilidade ao projeto antes da Cloud.

### 3.1 Antes de tornar o repositório público

- [x] **E-mail nos commits** (decidido: manter o e-mail pessoal): o e-mail configurado no Git aparece no histórico de um repositório público. Confira
      com `git log --format='%an <%ae>' | sort -u`. Se não quiser expô-lo, configure o e-mail _noreply_ do GitHub
      (`usuario@users.noreply.github.com`) e reescreva o histórico **antes** do primeiro push (são poucos commits).
- [x] Conferir que não há segredos no histórico (não há nenhum).
- [x] Adicionar `LICENSE` (AGPL-3.0) e uma seção "Como contribuir" no README.
- [x] Hospedar a fonte Inter localmente (pacote `@fontsource-variable/inter`) e remover o Google Fonts do
      `index.html` (feito na F1). Assim o app não contata terceiros ao abrir, o que fica coerente com a promessa de privacidade.
- [x] Ajustar o README: link para a versão publicada e instruções de clone/build/deploy.

### 3.2 Publicação

1. Criar o repositório no GitHub (público) e fazer o push da `main`.
2. Em _Settings › Pages_, escolher **GitHub Actions** como origem.
3. Workflow `.github/workflows/pages.yml`: em cada push na `main`, roda lint, tipos, testes e build
   (`VITE_EDITION=local`), e publica `dist/` com `actions/deploy-pages`.
4. O app já funciona em subpasta (`base: './'` e `HashRouter`), então a URL fica
   `https://<usuario>.github.io/<repositorio>/`.

### 3.3 Critérios de aceite

- A URL pública abre o app, cria orçamentos e gera PDF.
- Um clone limpo roda com `npm install && npm run dev`.
- O build do Pages não contém nenhum código da Cloud (Supabase), o que se confere pelo tamanho do bundle.

## 4. Arquitetura da Cloud

### 4.1 Visão geral

```mermaid
flowchart TB
    subgraph navegador["Navegador"]
        app["App React<br/>edição cloud"]
        cache[("IndexedDB<br/>cópia local por usuário + fila de envio")]
        app <--> cache
    end

    subgraph supabase["Supabase · São Paulo"]
        auth["Supabase Auth<br/>código por e-mail, Google"]
        api["API de dados<br/>PostgREST + RLS"]
        db[("Postgres<br/>auth.users + tabelas por usuário")]
        fn["Edge Functions<br/>checkout, webhook, excluir conta"]
        rt["Realtime<br/>aviso de mudanças"]
        auth --> db
        api --> db
        fn --> db
        db --> rt
    end
    smtp[["SMTP próprio<br/>(Resend, Brevo…)"]]
    pay[["Provedor de pagamento<br/>(Asaas, Mercado Pago…)"]]

    app -->|"login e sessão (JWT)"| auth
    auth -->|"envia o código"| smtp
    app -->|"lê e grava com o JWT"| api
    rt -.->|"houve mudança"| app
    app -->|"assinar plano / excluir conta"| fn
    fn -->|"cria cobrança"| pay
    pay -->|"webhook: pagamento"| fn
```

### 4.2 Componentes e responsabilidades

| Componente | Responsabilidade | Plano |
|---|---|---|
| **Supabase Auth** | Cadastro e login (código de 6 dígitos por e-mail, Google), sessão com renovação automática, CAPTCHA no envio do código. Usuários ficam em `auth.users`, no mesmo banco | 50.000 MAU no Free, 100.000 no Pro |
| **Supabase Postgres** | Dados de cada usuário, isolados por RLS (`user_id = auth.uid()`) | Free no desenvolvimento; **Pro (US$ 25/mês) em produção** (o Free pausa após 7 dias sem uso) |
| **Supabase Edge Functions** | Checkout e webhook do pagamento, exclusão de conta. Únicos lugares com chaves secretas | Incluso |
| **Supabase Realtime** | Avisar os outros dispositivos de que há mudanças (eles então sincronizam) | Incluso |
| **SMTP próprio** | Entregar os e-mails de login. O envio padrão do Supabase só atende membros da equipe e manda 2 e-mails/hora | Plano grátis do provedor (conferir) |
| **Provedor de pagamento** | Assinatura recorrente em reais (Pix, cartão, boleto) | Taxa por transação |
| **Cloudflare Pages** | Hospedagem do app Cloud no domínio próprio, com cabeçalhos de segurança (CSP) | Free |
| **Sentry** (opcional) | Erros em produção | Free |

**Por que tudo no Supabase:** um único fornecedor para identidade, dados, tempo real e funções. Tudo fica na região
São Paulo, o que inclui os dados de conta e simplifica a LGPD. As regras de acesso usam `auth.uid()` com chave
estrangeira para `auth.users`, então excluir a conta apaga os dados em cascata. Postgres padrão também é portável e
pode ser auto-hospedado, coerente com o repositório aberto. O Clerk e outros serviços de autenticação, além de
Firebase, InstantDB, Convex e PocketBase, foram avaliados em
[avaliacao-autenticacao-e-backend.md](avaliacao-autenticacao-e-backend.md). O **PowerSync** fica como plano B para a
sincronização offline, por cima do mesmo banco.

### 4.3 Uma base de código, duas edições

A edição é escolhida no build pela variável `VITE_EDITION=local|cloud`. O código da Cloud é carregado com
`import()` dinâmico atrás dessa variável, então o bundle Local não carrega o Supabase.

```
src/
  data/                     contrato de dados usado pelas telas (não muda entre edições)
    repository.ts           interface: ler/gravar perfis, clientes, catálogo, unidades, orçamentos
  editions/
    local/                  implementação atual (zustand + localStorage), sem mudanças de comportamento
    cloud/
      auth/                 telas de login (e-mail → código, Google), callback OAuth, guarda de rotas, sessão
      sync/                 cache IndexedDB, fila de envio, pull/push, conflitos, numeração
      billing/              tela de planos, limites, checkout
      supabase.ts           cliente Supabase (sessão do Supabase Auth)
supabase/
  migrations/               SQL versionado (tabelas, RLS, funções)
  functions/                create-checkout, billing-webhook, delete-account
  templates/                modelos de e-mail de login em pt-BR
  tests/                    testes de RLS (pgTAP)
e2e/                        testes Playwright (inclusive dois "dispositivos" sincronizando)
.github/workflows/          ci.yml, pages.yml (Local), cloud.yml (Cloud + migrações)
```

**Rotas:** a edição Local mantém `HashRouter` (necessário no GitHub Pages). A Cloud usa rotas por caminho
(`BrowserRouter`): o retorno do login com Google chega em `/auth/callback?code=…` (fluxo PKCE), o que conflitaria com
rotas por `#`. O Cloudflare Pages redireciona tudo para o `index.html` (`_redirects`).

**Estado na tela:** as telas continuam usando o store zustand. Na Cloud, o store deixa de persistir no
`localStorage` e passa a ser alimentado pelo motor de sincronização (seção 7). As telas não sabem de onde vêm os
dados.

## 5. Modelo de dados no Postgres

### 5.1 Estratégia: colunas de controle + documento JSON

Cada entidade vira uma tabela com:

- **colunas usadas pelo servidor** (dono, chaves, datas, status, número), para RLS, índices, limites e unicidade;
- **`data jsonb`** com o objeto completo, exatamente no formato dos tipos de `src/types.ts`.

Motivo: todos os cálculos (totais, relatórios, PDF) já rodam no navegador. Normalizar itens e acréscimos em tabelas
separadas daria trabalho de mapeamento sem benefício agora. Se um dia houver relatórios no servidor, as colunas
extraídas resolvem, e uma view pode expandir o JSON.

| Tabela | Colunas extraídas além do padrão | Observações |
|---|---|---|
| `user_settings` | — | 1 linha por usuário: unidades, preferências |
| `company_profiles` | `next_number int` | `next_number` é a fonte da verdade da numeração (seção 7.6). Nome evita confusão com "perfil de usuário" |
| `clients` | `name text`, `document_digits text` | |
| `catalog_items` | `description text` | |
| `quotes` | `profile_id uuid`, `number text`, `status text`, `issue_date date` | Itens, acréscimos, cliente e `statusHistory` ficam no `data` |
| `plan_limits` | `max_new_quotes_per_month`, `max_company_profiles` | Limites por plano (grátis: 15/mês e 1 empresa); ajustáveis sem migração |
| `subscriptions` | `plan`, `status`, `current_period_end`, `provider`, `provider_customer_id`, `provider_subscription_id` | Gravada **só** pelo servidor (gatilho de cadastro e Edge Functions) |
| `billing_events` | `provider`, `event_id` (único), `payload jsonb` | Idempotência e auditoria dos webhooks |

`activeProfileId` (empresa ativa) é preferência de cada dispositivo e fica só no local. As unidades vão para o
`user_settings.data`.

Colunas padrão de toda tabela sincronizada: `id uuid` (gerado no cliente), `user_id uuid` (de `auth.uid()`, com
chave estrangeira para `auth.users` e `on delete cascade`),
`rev int` (versão da linha), `updated_at timestamptz` (relógio do servidor), `deleted_at timestamptz`
(exclusão lógica, para os outros dispositivos saberem que algo foi apagado).

### 5.2 Esboço de SQL (migração inicial)

> Esboço de planejamento. A implementação real (F3) está em `supabase/migrations/` e difere em detalhes: tabela
> `company_profiles`, funções auxiliares no schema `private` e policies de INSERT com `private.can_create_quote()`.

```sql
-- Mantém rev/updated_at sob controle do servidor e impede trocar o dono da linha
create function public.touch_row() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.rev := old.rev + 1;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;

create table public.quotes (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id  uuid not null,
  number      text not null,
  status      text not null check (status in ('rascunho','enviado','aprovado','recusado')),
  issue_date  date not null,
  data        jsonb not null check (pg_column_size(data) < 262144), -- 256 KB por orçamento
  rev         int not null default 1,
  updated_at  timestamptz not null default clock_timestamp(),
  deleted_at  timestamptz
);
create index quotes_sync_idx on public.quotes (user_id, updated_at);
create unique index quotes_number_uq on public.quotes (user_id, profile_id, number) where deleted_at is null;
create trigger quotes_touch before insert or update on public.quotes
  for each row execute function public.touch_row();

alter table public.quotes enable row level security;

create policy "dono lê" on public.quotes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "dono cria (respeitando o plano)" on public.quotes for insert to authenticated
  with check ((select auth.uid()) = user_id and private.can_create_quote());
create policy "dono altera" on public.quotes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- Sem policy de DELETE: excluir = preencher deleted_at. Linhas excluídas há mais de 90 dias são
-- removidas por um job (pg_cron). A exclusão da conta apaga tudo pelo "on delete cascade".

-- Dados iniciais de cada novo usuário (substitui o webhook de cadastro)
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_settings (user_id, data) values (new.id, '{}'::jsonb); -- unidades padrão aplicadas pelo app
  insert into public.subscriptions (user_id, plan, status) values (new.id, 'free', 'active');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

As demais tabelas seguem o mesmo molde. A tabela `subscriptions` tem só policy de **leitura** para o dono. Escrita
apenas com a chave de serviço, dentro das Edge Functions.

### 5.3 Funções no banco (RPC)

Implementadas na F3 (`supabase/migrations/`). As chamáveis pelo app rodam como o usuário (RLS vale); as auxiliares
ficam no schema `private`, que a API não expõe.

| Função | Para quê |
|---|---|
| `aplicar_alteracoes(p_changes)` | Recebe um lote (até 500) da fila de envio: `{ table, id, data, base_rev, deleted }`. Cria se `base_rev` for nulo; altera **somente se** `rev` ainda for igual a `base_rev`; `deleted` faz/desfaz a exclusão lógica. Cada item é independente e volta em `applied` (com o novo `rev`), `conflicts` (com a linha atual do servidor) ou `rejected` (com o motivo: `limite_do_plano`, `dados_invalidos`, `duplicado`, `sem_permissao`) |
| `buscar_alteracoes(p_desde, p_limite)` | Por tabela, até `p_limite` linhas alteradas depois de `p_desde` (inclui excluídas), mais `has_more` e `server_time` |
| `reservar_numeros_orcamento(p_empresa, p_quantidade)` | Atômica: devolve o primeiro número de um bloco reservado. Testada com 100 reservas simultâneas, sem colisão |
| `definir_proximo_numero(p_empresa, p_proximo)` | Campo "Próximo número" da tela de empresa |
| `uso_do_plano()` | Plano em vigor, orçamentos criados no mês, empresas e os limites |
| `private.current_plan()`, `private.can_create_quote()`, `private.can_create_company_profile()` | Usadas nas policies de INSERT. O mês é contado no fuso de São Paulo, e excluídos contam (apagar não devolve cota) |
| `private.handle_new_user()` | Gatilho no cadastro: cria `user_settings` e a assinatura grátis |
| `private.purge_deleted_rows()` | Remove de vez linhas excluídas há mais de 90 dias (pg_cron, diário) |

Proteções feitas por gatilho: o servidor define `user_id` (sem o app enviar), `rev`, `inserted_at` e `updated_at`;
`data.id` precisa ser igual ao `id` da linha; colunas de orçamento são extraídas do documento; `next_number` só muda
pelas funções de numeração, e `data.nextNumber` sempre reflete o valor real.

### 5.4 Testes do banco

78 testes pgTAP em `supabase/tests/database/` (`npm run db:test`, também no CI):

- **isolamento:** um usuário não lê, não altera, não "adota" nem apaga linhas de outro; visitante sem login não acessa
  nada; excluir a conta apaga tudo em cascata; todas as tabelas têm RLS;
- **integridade:** versão sobe e não pode ser forjada; colunas extraídas; validações (status, data, número repetido);
  numeração protegida;
- **planos:** limites do grátis (orçamentos/mês e empresas), cota mensal, Pro, tolerância de 7 dias na
  inadimplência, nada é apagado ao voltar ao grátis;
- **sincronização:** criação, alteração, conflito, exclusão/restauração, lotes com itens inválidos, paginação da busca
  e numeração.

Os testes foram validados por sabotagem: desligar a RLS, remover o limite do plano ou quebrar o controle de versão
faz os testes correspondentes falharem.

## 6. Autenticação (Supabase Auth)

### 6.1 Telas e fluxos

| Rota | Conteúdo |
|---|---|
| `/entrar` | Campo de e-mail + botão "Continuar com Google". Envia o código e vai para a etapa do código |
| `/entrar` (etapa 2) | Campo de 6 dígitos (cola automática do código, `inputmode="numeric"`, reenvio liberado após 60 s) |
| `/auth/callback` | Retorno do Google: troca o `code` pela sessão (PKCE) e redireciona ao app |
| `/conta` | E-mail, contas vinculadas, "Sair", "Sair e apagar dados deste dispositivo", "Exportar dados", "Excluir conta" |

Não há tela separada de cadastro. O primeiro código enviado a um e-mail novo cria a conta
(`shouldCreateUser: true`), e o gatilho `handle_new_user` prepara os dados iniciais. Todas as outras rotas exigem
sessão.

```ts
// Envio do código e verificação
await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, captchaToken } })
await supabase.auth.verifyOtp({ email, token: codigo, type: 'email' })

// Google
await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })
```

### 6.2 Configuração

> **Antes de implementar as telas**, consultar o Modern Web Guidance (`npm run -s mwg -- search ...`), em especial
> os guias de formulários e de passkeys: campo de código com `autocomplete="one-time-code"` e `inputmode="numeric"`,
> e-mail com `autocomplete="email webauthn"` (deixa o caminho pronto para passkeys no futuro), mensagens de erro
> anunciadas a leitores de tela e o fluxo de passkeys (`passkey-registration`, `passkey-authentication`) como
> evolução do login por código.

- **Cliente:** `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: 'pkce' } })`.
  O supabase-js guarda e renova a sessão sozinho; o mesmo cliente é usado pelo motor de sincronização.
- **E-mail com código:** já vem ativo. O modelo do e-mail "Magic Link" passa a mostrar o código (`{{ .Token }}`), em
  pt-BR, com o nome do produto (`supabase/templates/`). O código vale 1 hora (configurável) e pode ser pedido 1 vez
  por minuto por usuário.
- **SMTP próprio (obrigatório):** o envio padrão do Supabase só entrega para membros da equipe e é limitado a
  2 e-mails/hora. Com SMTP próprio, o limite padrão é 30 e-mails/hora, ajustável em _Rate Limits_. Configurar
  SPF, DKIM e DMARC no domínio remetente (`login@orcafacil.murilloferrari.tech`).
- **Google:** criar o cliente OAuth no Google Cloud (tela de consentimento com nome, logo e política de privacidade)
  e cadastrar as URLs de retorno em _Authentication › URL Configuration_ (produção, staging e localhost).
- **CAPTCHA:** Cloudflare Turnstile no envio do código, para evitar abuso do SMTP.
- **Duração da sessão:** padrão do Supabase (token curto com renovação automática), adequado para o celular ficar
  conectado.

### 6.3 Conta

- **Sair:** `supabase.auth.signOut()` mantém a cópia local (separada por usuário). "Sair e apagar dados deste
  dispositivo" também limpa o IndexedDB, para computadores compartilhados.
- **Excluir conta:** Edge Function `delete-account`. Ela confirma a sessão, cancela a assinatura no provedor de
  pagamento e chama `auth.admin.deleteUser(uid)`. O `on delete cascade` apaga todas as tabelas do usuário.
- **Plano na interface:** lido da tabela `subscriptions`. Se for útil ter o plano no próprio token, um
  _Custom Access Token Hook_ pode incluir a claim `plan`, apenas para a interface. A segurança continua no banco.

## 7. Sincronização entre dispositivos

O coração da etapa: é o que entrega o diferencial "meus dados em qualquer dispositivo" sem perder a rapidez e o uso
offline.

### 7.1 Princípios

1. **Local primeiro:** a tela sempre lê e grava na cópia local (IndexedDB) e responde na hora.
2. **Fila de envio (outbox):** toda gravação entra numa fila persistente e é enviada quando houver conexão.
3. **Pull incremental:** cada dispositivo busca só o que mudou desde a última sincronização.
4. **Idempotência:** reenviar a mesma alteração não causa efeito duplicado (o `id` vem do cliente e o `rev` é
   conferido).

### 7.2 Cópia local

- IndexedDB (biblioteca `idb`), um banco **por usuário** (`orcafacil:<userId>`), com os stores `profiles`,
  `clients`, `catalog_items`, `quotes`, `settings`, `outbox`, `meta` (cursores de sync) e `conflicts`.
- Motivo para não usar o `localStorage`: o limite de cerca de 5 MB e a gravação síncrona travam com históricos
  grandes. O IndexedDB aguenta centenas de MB.
- Na abertura do app, o store zustand é carregado do IndexedDB. Depois, toda ação do store grava no IndexedDB e na
  outbox.

### 7.3 Ciclo de sincronização

```mermaid
sequenceDiagram
    autonumber
    participant T as Tela
    participant L as Cópia local (IndexedDB)
    participant S as Motor de sync
    participant DB as Supabase

    T->>L: grava orçamento (rev base = 3)
    L->>S: item novo na fila de envio
    Note over S: dispara ao gravar, ao voltar a conexão,<br/>a cada 60 s e ao receber aviso do Realtime
    S->>DB: aplicar_alteracoes([...lote da fila])
    alt rev confere
        DB-->>S: aplicado, rev = 4
        S->>L: atualiza rev e remove da fila
    else outro dispositivo alterou antes
        DB-->>S: conflito + versão do servidor
        S->>L: guarda a versão local em "conflitos" e aplica a do servidor
        S->>T: aviso "atualizado a partir de outro dispositivo"
    end
    S->>DB: busca mudanças desde o último cursor (updated_at)
    DB-->>S: linhas alteradas e excluídas
    S->>L: aplica e avança o cursor
    L->>T: tela atualiza
```

### 7.4 Pull incremental

- Por tabela: `select … where updated_at > :cursor - interval '10 seconds' order by updated_at limit 500`.
- A janela de 10 s cobre transações confirmadas fora de ordem. Como a aplicação é idempotente (compara `rev`), ler
  a mesma linha duas vezes não tem efeito.
- Linhas com `deleted_at` removem o registro da cópia local.
- O Realtime (`postgres_changes` filtrado por `user_id`) só **avisa** que há novidade. Os dados vêm pelo pull, o
  que mantém um único caminho de leitura e tolera mensagens perdidas.

### 7.5 Conflitos (decisão D8)

- Unidade de conflito: o **registro inteiro** (um orçamento, um cliente).
- A versão do servidor prevalece. A versão local perdida vai para o store `conflicts`, com data e dispositivo.
- _Ajustes › Versões substituídas_ lista os últimos 30 dias e permite restaurar com um clique (a restauração vira
  uma nova gravação). **Decidido (23/11/2026): entra na F5**, porque é a única proteção contra perda de edição.
- **Decidido (23/11/2026): fora da F5.** Nesta fase, todo conflito de orçamento segue "prevalece o servidor" e a
  versão local vai para _Versões substituídas_. A união de `statusHistory` fica para depois.

### 7.6 Numeração de orçamentos com vários dispositivos

O problema: dois dispositivos offline criariam o mesmo `ORC-0042`.

A solução é a **reserva de blocos por dispositivo**:

1. Online, cada dispositivo reserva um bloco pequeno (ex.: 3 números) por empresa, via `reservar_numeros_orcamento`.
2. Novos orçamentos usam o próximo número do bloco local, mesmo offline.
3. Quando o bloco acaba, reserva outro, se houver conexão.
4. Offline e sem números sobrando, o orçamento é criado com número provisório ("definido ao sincronizar"). O PDF
   fica bloqueado até a sincronização, porque não pode sair um PDF com número que vá mudar.

Consequência aceitável: podem surgir **saltos** na numeração (números reservados e não usados). Orçamento não é
documento fiscal, então não exige sequência sem lacunas. Isso deve ser explicado na tela de empresa.

O campo "Próximo número" da empresa passa a ser alterado por RPC. O índice único `(user_id, profile_id, number)`
impede duplicidade.

### 7.6.1 Fila e sincronização na F5 (decidido em 23/11/2026)

- **Captura por diferença:** um módulo compara o store com a última versão sincronizada, por `id`, e enfileira
  só o que mudou. As ações do store não mudam.
- **Uma entrada por registro na fila:** várias edições offline do mesmo registro viram uma entrada com o último
  estado e o `base_rev` original. Sem isso, o dispositivo entraria em conflito consigo mesmo.
- **Lotes de até 50** pelo `aplicar_alteracoes`. `applied` remove da fila; `conflicts` vai para o store
  `conflicts`; `rejected` fica marcado com o motivo e não é reenviado em loop.
- **Pull** pelo `buscar_alteracoes`, com cursor por tabela (`updated_at` menos 10 s) e repetição enquanto
  `has_more`.
- **Quando sincroniza:** ao gravar (com atraso de 1 s), ao voltar a conexão, ao voltar para a aba e a cada 60 s.
  Realtime fica para depois (decidido).
- **Armazenamento:** IndexedDB `orcafacil:<userId>` com `records`, `outbox`, `conflicts` e `meta`.
- **IDs:** na Cloud, o `id` é UUID gerado com `crypto.getRandomValues` (sem fallback não criptográfico).

### 7.7 Indicador de sincronização

No topo do app: "Sincronizado", "Sincronizando…", "Offline — N alterações pendentes" ou "Erro — tentar de novo".
Itens com envio pendente mostram um ícone discreto.

## 8. Migração da edição Local para a Cloud

1. No primeiro login, se o navegador tiver dados da edição Local (`gerador-orcamento:v1`), oferecer
   **"Enviar meus dados para a nuvem"**.
2. O mesmo fluxo aceita o **arquivo de backup JSON** (_Ajustes › Importar_) vindo de outro computador.
3. A importação passa por `normalizeQuote` e pelo envio em lotes da sincronização. Os IDs locais são mantidos (já
   são UUID), e as numerações e `next_number` são preservados.
4. **Conta nova + dados locais:** importa direto. **Conta com dados + dados locais:** pergunta se deve juntar
   (registros com mesmo `id` ficam com o mais recente) ou ignorar.
5. Volta garantida: _Ajustes › Exportar backup_ continua existindo na Cloud, no mesmo formato da Local. A pessoa
   pode sair da Cloud a qualquer momento levando tudo.

Limites do plano grátis **não** bloqueiam a importação (o limite vale para criar novos orçamentos), para não punir
quem migra.

## 9. Planos, limites e cobrança

### 9.1 Proposta de planos (decisão D5 — valores são hipóteses)

| | Local | Cloud Grátis | Cloud Pro |
|---|---|---|---|
| Preço | R$ 0 | R$ 0 | ex.: R$ 19,90/mês ou R$ 199/ano |
| Orçamentos novos por mês | ilimitados | ex.: 15 | ilimitados |
| Empresas (perfis) | ilimitadas | 1 | ilimitadas |
| Dispositivos sincronizados | — | ilimitados | ilimitados |
| Relatórios, PDF, catálogo, clientes | sim | sim | sim |
| Restaurar versões substituídas | — | 7 dias | 30 dias |
| Futuro (fora deste plano): link público do orçamento com aceite online, envio por e-mail, logo no PDF | — | — | sim |

Critério: o grátis precisa ser útil de verdade (quem orça pouco não paga). O Pro é para quem vive de orçamento.
Limitar por volume e por número de empresas é simples de explicar e de verificar no servidor.

### 9.2 Provedor de pagamento (decisão D4)

| Provedor | A favor | Contra / verificar |
|---|---|---|
| **Asaas** | Assinaturas com Pix, boleto e cartão; emissão de NFS-e; API com webhooks; sandbox; popular entre SaaS brasileiros | Exige conta PJ (CNPJ/MEI); conferir as taxas atuais |
| **Mercado Pago** | Assinaturas (preapproval); marca conhecida do público | Pix recorrente e regras de assinatura precisam ser validados no sandbox |
| **Stripe** | Melhor API; Pix Automático para assinaturas desde abril/2026 | A documentação de Pix recorrente não lista o Brasil entre os países do vendedor; repasse mais lento |
| **Paddle** | _Merchant of record_: a Paddle vende em seu nome e cuida de impostos e notas; oferece Pix Automático | Taxa maior; menos controle |

Para qualquer um deles, a integração é isolada numa Edge Function por provedor. Trocar de provedor não mexe no app.

### 9.3 Fluxo de assinatura

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuário
    participant A as App
    participant F as Edge Function
    participant P as Provedor de pagamento
    participant DB as Supabase (subscriptions)

    U->>A: "Assinar Pro"
    A->>F: create-checkout (JWT da sessão)
    F->>P: cria cliente e assinatura (referência = user_id)
    P-->>F: link de pagamento
    F-->>A: link
    A->>U: abre o pagamento (Pix, cartão ou boleto)
    U->>P: paga
    P->>F: webhook "pagamento confirmado" (assinatura verificada)
    F->>DB: grava evento (idempotente) e plano = pro, válido até X
    DB-->>A: aviso do Realtime (ou nova leitura da assinatura)
    A->>U: "Plano Pro ativo"
```

- **Fonte da verdade:** a tabela `subscriptions`. As policies (`private.can_create_quote()` e `private.can_create_company_profile()`) consultam essa tabela, então
  não dá para burlar o limite alterando o app.
- **Inadimplência:** pagamento atrasado → aviso no app → após 7 dias, volta para o Grátis. **Nenhum dado é
  apagado**: só a criação acima do limite fica bloqueada.
- **Cancelamento:** vale até o fim do período pago.
- **Webhooks:** verificar assinatura/token, registrar em `billing_events` (com `event_id` único, o que dá
  idempotência), responder rápido e reprocessar se falhar.

## 10. Segurança

- **RLS em todas as tabelas**, testada (seção 5.4). Nenhuma tabela exposta sem policy.
- **Chaves:** no app, só as públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_TURNSTILE_SITE_KEY`). As secretas (chave de serviço do Supabase, credenciais do SMTP, segredo do Google
  OAuth, segredos do pagamento e do webhook) ficam **apenas** nos segredos do Supabase e do GitHub Actions. O
  repositório público não contém nenhuma.
- **Limites de tamanho** no banco (`pg_column_size`), para evitar abuso de armazenamento.
- **Cabeçalhos** no Cloudflare Pages (`_headers`): CSP liberando só o próprio domínio, o Supabase e o Turnstile;
  `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`.
- Webhook do pagamento com verificação de assinatura/token e rejeição de eventos repetidos.
- Proteção do login: CAPTCHA no envio do código, limites de envio do Supabase Auth e alerta de picos de cadastro.
- Dependências: Dependabot e `npm audit` no CI.

## 11. LGPD e aspectos legais

- **Papéis:** para os dados da conta, o Orçafácil é **controlador**. Para os dados dos clientes que o usuário
  cadastra (nome, CPF, telefone), o Orçafácil é **operador**, e o usuário é o controlador.
- **Documentos:** Termos de Uso, Política de Privacidade e aviso de armazenamento local (a sessão e a cópia offline
  ficam no navegador; não há cookies de rastreamento). **Recomenda-se revisão jurídica** antes do lançamento.
- **Suboperadores** listados na política (Supabase, provedor de SMTP, provedor de pagamento, Cloudflare, Google para
  o login social, Sentry), com links para os acordos de tratamento de dados (DPA) de cada um.
- **Localização:** banco e contas na região São Paulo (`sa-east-1`). O e-mail do usuário passa pelo provedor de
  SMTP e, no login com Google, pelo Google. A política deve citar essas transferências.
- **Direitos do titular:** exportação (backup JSON), correção (o próprio app) e exclusão (_Conta › Excluir conta_ →
  `delete-account` → `on delete cascade` apaga tudo). Prazo de remoção definitiva dos backups do Supabase informado na política.
- **Incidentes:** procedimento simples documentado (quem avisa, em quanto tempo, como).

## 12. Infraestrutura, CI/CD e operação

### 12.1 Ambientes

| Ambiente | App | Supabase (banco + Auth) | E-mails de login |
|---|---|---|---|
| Local de desenvolvimento | `npm run dev:cloud` | `supabase start` (Docker) | Capturados pelo Mailpit/Inbucket do Supabase local |
| Prévia (por PR) | Cloudflare Pages preview | projeto `staging` | SMTP real, domínio de teste |
| Produção | `app.<dominio>` | projeto `production` (Pro, São Paulo) | SMTP real, `login@<dominio>` |

Cada projeto tem suas URLs de retorno (Google/PKCE) cadastradas em _Authentication › URL Configuration_.

### 12.2 Pipelines (GitHub Actions)

- `ci.yml` (todo PR): Prettier, oxlint, `tsc`, Vitest, build das **duas** edições, testes pgTAP (Supabase em
  Docker), Playwright.
- `pages.yml` (push na `main`): publica a edição Local no GitHub Pages.
- `cloud.yml` (tag `v*` ou aprovação manual): `supabase db push` (migrações) → deploy das Edge Functions → build da
  Cloud → Cloudflare Pages.

### 12.3 Operação

- **Backups:** diários no Supabase Pro (retenção de 7 dias), mais o backup que o próprio usuário pode exportar.
  Point-in-time recovery é um adicional pago, a avaliar quando houver receita.
- **Monitoramento:** Sentry (erros do app e das funções), logs do Supabase, uptime da página e do webhook.
- **Alertas de cota:** uso do banco perto de 8 GB e usuários ativos do Auth perto de 100 mil (limites do Pro);
  envios do SMTP perto da cota do plano.

## 13. Testes

| Camada | Ferramenta | O que cobre |
|---|---|---|
| Regras puras | Vitest | `lib/` (cálculos, máscaras, validação), `reports/data.ts` (portar os cenários já usados nas validações manuais) |
| Sincronização | Vitest + `fake-indexeddb` + servidor falso | Fila, idempotência, conflitos, reserva de números, retomada após falha de rede |
| Banco | pgTAP | Isolamento por RLS, limites do plano, `rev`, reserva concorrente de números |
| Ponta a ponta | Playwright | Login por código (lido do Mailpit do Supabase local); criar orçamento num "dispositivo" e vê-lo no outro; offline → online; importação da Local; upgrade de plano no sandbox do pagamento; exclusão de conta |

## 14. Fases, entregas e estimativas

Estimativas para uma pessoa desenvolvendo com apoio do Claude Code, em dias úteis de trabalho efetivo.

| Fase | Entregas | Estimativa |
|---|---|---|
| **F0 · Decisões e contas** | Decisões D1–D10; domínio; contas Supabase/Cloudflare/SMTP/pagamento; cliente OAuth do Google; repositório no GitHub | 1 dia |
| ✅ **F1 · Fundação** (concluída em 18/11/2026) | Vitest com 95 testes das regras atuais; camada `src/data/` + `src/editions/` sem mudar comportamento; variável `VITE_EDITION` validada no build; fonte Inter local; CI (`ci.yml`) | 2–3 dias |
| ✅ **F2 · Etapa 1 publicada** (18/11/2026) | LICENSE, README, workflow do Pages, repositório público | 0,5–1 dia |
| ✅ **F3 · Banco** (concluída em 18/11/2026; `staging` online em 23/11/2026) | Migrações, RLS, triggers (incl. `handle_new_user`), RPCs, 78 testes pgTAP + job no CI, tipos TypeScript gerados | 2–3 dias |
| 🟡 **F4 · Autenticação** (código pronto e testado no banco local em 23/11/2026; falta configurar o projeto online) | Telas de login (código e Google) e de conta em pt-BR, callback PKCE, rotas protegidas, SMTP com SPF/DKIM/DMARC, modelos de e-mail, Turnstile, `delete-account` | 2–3 dias |
| **F5 · Sincronização** | IndexedDB, outbox, push/pull, Realtime, conflitos, reserva de números, indicador de status, testes | 4–6 dias |
| **F6 · Migração e conta** | Importar da Local/backup, exportar, excluir conta | 1–2 dias |
| **F7 · Planos e cobrança** | Tela de planos/uso, checkout, webhook do provedor, inadimplência, testes no sandbox | 3–5 dias |
| **F8 · Segurança e LGPD** | Cabeçalhos/CSP, revisão de RLS, Termos e Política (+ revisão jurídica), página de status | 1–2 dias |
| **F9 · Produção** | Supabase Pro em São Paulo, domínio e DNS (app + e-mail), Google OAuth publicado, Cloudflare Pages, Sentry, pipelines | 1–2 dias |
| **F10 · Beta e lançamento** | Beta fechado (5–10 autônomos reais), correções, landing page, lançamento | 1–2 semanas de calendário |

**Total de desenvolvimento:** cerca de 18 a 29 dias, mais o período de beta.

Ordem e paralelismo: F0 → F1 → (F2 em paralelo) → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10. F7 pode começar após
F4, em paralelo com F5, se houver duas frentes.

### Critérios de aceite da etapa 2 (resumo)

- Criar um orçamento no celular e vê-lo no computador em até 5 segundos, ambos online.
- Criar e editar orçamentos offline; ao voltar a conexão, tudo sincroniza sem duplicar números.
- Um usuário nunca acessa dados de outro (provado por testes automatizados de RLS).
- Usuário vindo da edição Local leva todos os dados para a nuvem em poucos cliques.
- O código de login chega em até 1 minuto na caixa de entrada (não no spam) de Gmail e Outlook.
- Plano grátis bloqueia acima do limite no servidor, e o Pro libera assim que o pagamento é confirmado.
- Excluir a conta apaga todos os dados do usuário.
- A edição Local publicada no GitHub Pages continua funcionando, sem nenhum código da Cloud no bundle.

## 15. Custos estimados

| Item | Desenvolvimento | Produção (início) |
|---|---|---|
| Domínio `.com.br` | — | cerca de R$ 40/ano |
| Supabase (banco + Auth) | US$ 0 (Free) | **US$ 25/mês** (Pro: sem pausa, 8 GB, backups diários, 100.000 MAU no Auth) |
| SMTP (Resend/Brevo) | US$ 0 | US$ 0 no plano grátis do provedor enquanto o volume for baixo (conferir cotas) |
| Cloudflare Pages | US$ 0 | US$ 0 |
| Sentry | US$ 0 | US$ 0 (plano gratuito) |
| Pagamento | — | % por transação (depende de D4) |
| Revisão jurídica (Termos/Política) | — | pontual, a orçar |

Custo fixo inicial: cerca de **US$ 25/mês + domínio**. Com o Pro a ~R$ 20/mês, algo como 7 a 8 assinantes cobrem a
infraestrutura (considerando taxas e câmbio).

## 16. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Bugs de sincronização causarem perda de dados | Alto | Versões substituídas guardadas; testes de sync dedicados; backup exportável; beta antes do lançamento |
| Mudança de preço/limite do Supabase | Médio | Integração isolada (`editions/cloud/`); Postgres padrão, portável e auto-hospedável |
| E-mail de login cair no spam ou atrasar | Alto | SMTP transacional com SPF/DKIM/DMARC; remetente exclusivo de login; botão do Google como alternativa; monitorar entregas |
| Provedor de pagamento recusar a conta ou mudar regras | Médio | Integração isolada por provedor; plano B entre as opções da seção 9.2 |
| Free do Supabase pausar o `staging` | Baixo | Esperado; reativar quando preciso. Produção já nasce no Pro |
| Complexidade do offline atrasar o projeto | Médio | Se preciso, lançar a F5 em duas partes: (a) online com cache de leitura, (b) escrita offline |
| Obrigações fiscais da venda (NFS-e) | Médio | Provedor que emite NFS-e (Asaas) ou _merchant of record_ (Paddle); falar com contador |
| Repositório público facilitar cópias | Baixo/médio | Licença AGPL (D1); o valor da Cloud está na operação e nos dados sincronizados |

## 17. Próximos passos imediatos

1. ~~Responder às decisões D1, D2, D3 e D10~~ (feito; domínio passou a ser `orcafacil.murilloferrari.tech`);
   D4–D8 até a F7.
2. ~~Executar a F1 (testes + camada de dados)~~ (feito em 18/11/2026).
3. ~~Executar a F2 e publicar a edição Local~~ (feito: <https://murillo-ferrari.github.io/orca-facil/>).
4. ~~F3 (banco)~~ (feito). Projeto `staging` criado (`orca-facil`, ref `tqysyqwzqyuiwbudnfqc`) e migrações
   aplicadas em 23/11/2026 com `supabase db push --remote` (na CLI v3, sem `--remote` o alvo é o banco local).
5. **F4 (autenticação)** em andamento. Código feito: `src/editions/cloud/` (`supabase.ts`, `auth/AuthGate`, `Login`,
   `AccountCard` em Ajustes), `supabase/templates/codigo.html`, `supabase/functions/delete-account`. Diferenças do
   esboço: não há rota `/entrar` (sem sessão, qualquer rota mostra o login) nem `/conta` (a conta fica em Ajustes).
   Falta no projeto online: SMTP do Resend + DNS, modelos de e-mail, URLs de retorno, Google OAuth, Turnstile e o
   deploy da função `delete-account`.

## Fontes consultadas (novembro de 2026)

- Comparativo completo de autenticação e backend: [avaliacao-autenticacao-e-backend.md](avaliacao-autenticacao-e-backend.md)
- Clerk Billing — países não suportados (inclui o Brasil), motivo da troca: <https://clerk.com/docs/guides/billing/overview>
- Supabase — preços e cotas (Auth: 50.000 MAU Free / 100.000 Pro): <https://supabase.com/pricing>
- Supabase Auth — login por código no e-mail (`signInWithOtp`/`verifyOtp`, validade e limites): <https://supabase.com/docs/guides/auth/auth-email-passwordless>
- Supabase Auth — SMTP próprio (envio padrão restrito, limite de 30/h ajustável, provedores recomendados): <https://supabase.com/docs/guides/auth/auth-smtp>
- Supabase — limites do plano Free e pausa por inatividade (resumo de terceiros): <https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/>
- Stripe — Pix recorrente (abril/2026): <https://docs.stripe.com/changelog/dahlia/2026-04-22/pix-recurring-payments-support> e <https://docs.stripe.com/payments/pix/accept-a-recurring-payment>
- Paddle — Pix Automático: <https://developer.paddle.com/changelog/2026/pix-automatico>
- Asaas — preços e meios de pagamento: <https://www.asaas.com/precos-e-taxas>
