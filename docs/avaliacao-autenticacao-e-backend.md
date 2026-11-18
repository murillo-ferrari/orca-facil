# Avaliação — autenticação e backend da edição Cloud

> Complementa o [plano da versão Cloud](plano-versao-cloud.md). Pergunta: sem o Clerk Billing (indisponível no
> Brasil), ainda vale usar o Clerk? E quais são as alternativas ao Supabase? Números de terceiros conferidos em
> novembro de 2026; os marcados com "(a confirmar)" vieram só de agregadores e precisam ser verificados na página
> oficial antes de contratar.

## 1. Resumo

- **Recomendação:** trocar o Clerk pelo **Supabase Auth** e manter o **Supabase** como backend. Sem a cobrança, o que
  o Clerk ainda oferece é sobretudo **telas de login prontas**. Em troca, ele traz um segundo fornecedor, uma
  integração de tokens entre dois serviços, a exigência de domínio próprio para o login e dados de conta fora do
  Brasil. O Supabase Auth tem a mesma cota gratuita (50 mil usuários ativos/mês), fica no mesmo banco em São Paulo e
  conversa nativamente com as regras de acesso (RLS).
- **Alternativa mais forte ao Supabase:** **Firebase** (Auth + Firestore), porque traz **uso offline e
  sincronização prontos**. Isso elimina a maior parte da fase mais cara do plano (F5). O preço é trocar SQL por
  documentos NoSQL, cobrança por leitura e mais dependência do Google.
- **Meio-termo para avaliar:** Supabase + **PowerSync** (camada de sincronização offline sobre o Postgres), caso o
  motor de sincronização próprio se mostre trabalhoso demais.

## 2. O que precisamos (critérios)

| # | Critério | Peso | Por quê |
|---|---|---|---|
| C1 | Login por e-mail sem senha (código) + Google, em pt-BR | Alto | Público não técnico, uso no celular |
| C2 | Dados isolados por usuário, garantido no servidor | Alto | Segurança/LGPD; dados de clientes (CPF, telefone) |
| C3 | Uso offline e sincronização entre dispositivos | Alto | É o diferencial da Cloud; trabalho de campo sem sinal |
| C4 | Dados no Brasil | Médio | Simplifica a LGPD (sem transferência internacional) |
| C5 | Custo baixo no início e previsível depois | Médio | Projeto pequeno; receita incerta |
| C6 | Pouca dependência de fornecedor / possibilidade de auto-hospedar | Médio | Repositório público; quem clonar pode querer rodar a própria nuvem |
| C7 | Pouco código e pouca operação para manter | Alto | Uma pessoa desenvolvendo |
| C8 | Maturidade/estabilidade do fornecedor | Médio | Dados de terceiros dependem disso |

## 3. Reavaliação do Clerk

### 3.1 O que o Clerk ainda entrega sem o Billing

| Entrega | Vale quanto aqui? |
|---|---|
| Telas prontas de login, cadastro e conta (`<SignIn/>`, `<UserProfile/>`) com tradução pt-BR | **É o principal ganho.** Mas o nosso login é simples (e-mail + código, botão Google): duas ou três telas |
| Proteção contra bots/abuso no cadastro | Útil; o Supabase tem CAPTCHA (hCaptcha/Turnstile) configurável |
| Gestão de sessões por dispositivo, MFA, passkeys | Bom de ter, mas não é requisito agora |
| Organizações/equipes | Não precisamos (um autônomo = uma conta) |
| Cota grátis de 50 mil usuários retidos/mês | O Supabase Auth tem a mesma cota (50 mil MAU) |

### 3.2 O que o Clerk custa (em complexidade)

- **Dois fornecedores** para uma coisa só (identidade + dados), com integração de token entre eles (third-party auth
  no Supabase).
- **Domínio próprio obrigatório** em produção, com CNAME `clerk.<dominio>`.
- **Dados de conta fora do Brasil:** mais um item de transferência internacional na política de privacidade.
- **Webhook extra** (Svix) para criar/apagar os dados do usuário no banco, em vez de um gatilho no próprio banco.
- Regras de acesso usam `auth.jwt()->>'sub'` (texto), em vez da chave estrangeira nativa `auth.uid()` →
  `auth.users`, que permite `on delete cascade` na exclusão da conta.

**Conclusão:** sem o Billing, o Clerk deixa de compensar neste projeto. Ele só voltaria a fazer sentido se o login
ganhasse requisitos que o Supabase Auth não cobre bem (ex.: organizações com papéis, SSO corporativo).

### 3.3 Alternativas ao Clerk (só autenticação)

| Serviço | Tipo | Cota grátis | Observações |
|---|---|---|---|
| **Supabase Auth** | Integrado ao Supabase | 50 mil MAU (Pro: 100 mil; excedente US$ 0,00325/MAU) | E-mail com código/link, Google e outros, CAPTCHA, hooks; **exige SMTP próprio** em produção (o envio padrão só atende membros da organização desde 2024) |
| **Firebase Authentication** | Integrado ao Firebase | 50 mil MAU (a confirmar) | Maduro; SMS cobrado à parte |
| **Auth0** (Okta) | SaaS | 25 mil MAU, sem MFA no grátis | Robusto e corporativo; pesado para o caso |
| **Kinde** | SaaS | Plano grátis; pagos a partir de US$ 25/mês (limites a confirmar) | Telas prontas, parecido com o Clerk |
| **WorkOS AuthKit** | SaaS | Plano grátis (limites a confirmar) | Foco em B2B/SSO |
| **Better Auth** | Biblioteca de código aberto | Grátis (você hospeda) | Precisa de um servidor (Edge Function/Worker) e banco; controle total |
| **Stack Auth** | Código aberto + nuvem | Plano grátis (a confirmar) | Alternativa aberta ao Clerk; base do Neon Auth |
| **Logto / Zitadel / Keycloak** | Código aberto, auto-hospedado | Grátis (você hospeda) | Exigem operar mais um serviço |

Para este projeto, **nenhum supera o auth embutido do próprio backend** escolhido: Supabase Auth com Supabase,
Firebase Auth com Firebase. Um serviço de auth separado só se justifica com um backend que não tenha auth (ex.:
Cloudflare D1, Neon).

## 4. Alternativas ao Supabase (backend)

### 4.1 Comparativo

| Opção | Auth incluso | Offline + sync | Dados no Brasil | Custo inicial | Dependência | Esforço para nós |
|---|---|---|---|---|---|---|
| **Supabase** (Postgres + Auth + Realtime + Edge Functions) | Sim | **Não pronto:** construímos (plano F5) | Sim (São Paulo) | Free; produção Pro US$ 25/mês (Free pausa após 7 dias sem uso) | Baixa: Postgres padrão, auto-hospedável | Médio |
| **Supabase + PowerSync** | Sim (Supabase) | **Sim:** SQLite local sincronizado com o Postgres | Banco sim; PowerSync Cloud: verificar região | + PowerSync Free (2 GB sincronizados/mês, a confirmar); Pro a partir de US$ 49/mês | Média (há edição aberta auto-hospedável) | Baixo/médio |
| **Firebase** (Auth + Firestore + Functions) | Sim | **Sim, nativo** (cache persistente no IndexedDB, escrita offline) | Sim (`southamerica-east1`) | Spark grátis: 1 GiB, 50 mil leituras e 20 mil gravações/dia; ao estourar, **para** até o mês seguinte. Produção no Blaze (pago por uso) | **Alta** (Google, NoSQL proprietário) | **Baixo** |
| **InstantDB** | Sim (código por e-mail, Google) | **Sim, nativo** (cache local, escrita otimista, tempo real) | A confirmar | Grátis com 1 GB e sem pausa; Pro ~US$ 30/mês (a confirmar) | Média (código aberto, empresa jovem) | **Baixo** |
| **Convex** | Sim (Convex Auth) | Tempo real e atualizações otimistas, mas **não é offline-first** | A confirmar | Grátis: 0,5 GB, 1 milhão de chamadas/mês; Pro ~US$ 25/mês (a confirmar) | Alta (modelo próprio) | Médio |
| **Appwrite Cloud** | Sim (75 mil MAU no grátis, a confirmar) | Não pronto na web | A confirmar | Grátis; Pro US$ 15–25/mês (fontes divergem) | Média (código aberto) | Médio |
| **PocketBase** (auto-hospedado) | Sim | Não pronto | Sim, se o servidor estiver no Brasil | VPS ~US$ 5–10/mês | Baixa (um binário, SQLite) | Médio + **operar servidor** |
| **Cloudflare Workers + D1 + Better Auth** | Via Better Auth | Não pronto | Não controlável (rede global) | Praticamente grátis no início | Média | **Alto** (API própria) |
| **Neon + Neon Auth** | Sim (Stack Auth) | Não pronto | A confirmar | Plano grátis | Baixa (Postgres) | Alto (falta a camada de API/RLS pronta) |

### 4.2 Leitura do comparativo

- **Supabase** continua o mais equilibrado: SQL, RLS, auth, tempo real e funções num só lugar, dados em São Paulo,
  dados portáveis (Postgres) e possibilidade de auto-hospedar, o que combina com o repositório aberto. O ponto fraco
  é não trazer offline pronto.
- **Firebase** é o que entrega o diferencial (offline + sync) com menos código. Os custos:
  - modelagem em documentos: nossos dados já são documentos JSON, então isso pesa pouco;
  - regras de segurança em linguagem própria, em vez de SQL;
  - cobrança por leitura: a sincronização inicial de um usuário com muitos orçamentos lê tudo uma vez;
  - limite diário do Spark que **derruba o app** ao estourar;
  - migrar para fora do Firebase depois é trabalhoso.
- **InstantDB** é tecnicamente o mais alinhado ao "local primeiro + tempo real", mas é o fornecedor mais jovem da
  lista. Risco de continuidade para dados de clientes.
- **PowerSync** permite manter o Supabase e terceirizar justamente a parte difícil (offline). Adiciona um fornecedor
  e custo a partir de certo volume.
- **Convex, Appwrite, PocketBase, Workers/D1 e Neon** não resolvem o offline e não superam o Supabase nos demais
  critérios para este caso.

### 4.3 Pontuação (1 = ruim, 5 = ótimo)

| Critério (peso) | Supabase | Supabase + PowerSync | Firebase | InstantDB |
|---|---|---|---|---|
| C1 Login (alto) | 4 | 4 | 5 | 4 |
| C2 Isolamento no servidor (alto) | 5 | 5 | 4 | 4 |
| C3 Offline/sync (alto) | 2 | 5 | 5 | 5 |
| C4 Dados no Brasil (médio) | 5 | 4 | 5 | 2 |
| C5 Custo (médio) | 4 | 3 | 4 | 4 |
| C6 Portabilidade (médio) | 5 | 4 | 2 | 3 |
| C7 Pouco código/operação (alto) | 3 | 4 | 5 | 5 |
| C8 Maturidade (médio) | 4 | 3 | 5 | 2 |
| **Total ponderado** (alto = 3, médio = 2; máximo 100) | **78** | **82** | **89** | **76** |

O Firebase vence no total porque resolve o offline. **Ainda assim, a recomendação é o Supabase (com Supabase
Auth)**, pelos critérios que a pontuação não captura bem:

1. **Portabilidade e coerência com o código aberto:** quem clonar o repositório pode subir o próprio Supabase
   (auto-hospedado). Com Firebase, a edição Cloud fica presa ao Google.
2. **O offline aqui é simples:** um usuário, poucos milhares de registros, quase sem edição simultânea. O motor
   próprio do plano (fila + pull incremental + versão por linha) cabe em poucos dias e fica sob nosso controle.
3. **Saída de emergência:** se o motor próprio complicar, o **PowerSync** entra por cima do mesmo banco, sem
   migrar dados. O inverso (sair do Firebase) não é tão simples.

Se a prioridade mudar para **lançar o mais rápido possível**, mesmo aceitando dependência do Google, o Firebase é a
escolha certa e o plano encolhe em cerca de 4 a 6 dias (a fase F5 quase some).

## 5. O que muda no plano com Supabase Auth no lugar do Clerk

| Área | Antes (Clerk) | Depois (Supabase Auth) |
|---|---|---|
| Fornecedores de identidade + dados | 2 | **1** |
| Coluna de dono | `user_id text default auth.jwt()->>'sub'` | `user_id uuid default auth.uid() references auth.users on delete cascade` |
| Regras de acesso | `(select auth.jwt()->>'sub') = user_id` | `(select auth.uid()) = user_id` |
| Criar dados iniciais do usuário | Webhook do Clerk → Edge Function | **Gatilho no banco** ao inserir em `auth.users` |
| Excluir conta | Webhook `user.deleted` | Edge Function chama `auth.admin.deleteUser`; o **cascade** apaga tudo |
| Telas de login | Componentes do Clerk | Telas próprias em pt-BR (e-mail → código de 6 dígitos; botão Google) |
| E-mails de login | Clerk envia | **SMTP próprio obrigatório** (ex.: Resend ou Brevo, com cotas grátis a confirmar) + modelos de e-mail em pt-BR |
| Domínio | Obrigatório para o Clerk | Recomendado: remetente dos e-mails (SPF/DKIM) e URL do app |
| Plano do usuário na interface | `publicMetadata` do Clerk | Tabela `subscriptions` (já era a fonte da verdade); opcionalmente uma claim no token via _Custom Access Token Hook_ |
| LGPD | Conta no Clerk (exterior) + dados no Brasil | **Tudo no Brasil** (São Paulo); só o SMTP e o pagamento são suboperadores externos |
| Esforço da fase F4 | 1–2 dias | 2–3 dias (telas próprias + SMTP) |
| Esforço total | 17–28 dias | **~17–28 dias** (telas a mais, webhooks e integração de token a menos) |

## 6. Decisão (tomada em 18/11/2026)

| # | Pergunta | Recomendação |
|---|---|---|
| A1 | Trocar Clerk por Supabase Auth? | **Sim — decidido** |
| A2 | Backend | **Supabase — decidido** (com motor de sincronização próprio) |
| A3 | Plano B para o offline | **PowerSync** sobre o mesmo Supabase, se a F5 passar de ~6 dias ou os testes mostrarem fragilidade |
| A4 | Prioridade é velocidade acima de portabilidade? | **Não** (portabilidade escolhida); Firebase descartado |

O [`plano-versao-cloud.md`](plano-versao-cloud.md) já foi atualizado com essas decisões (arquitetura, SQL,
autenticação, fluxo de assinatura, segurança, LGPD, ambientes, fases, custos e riscos).

## Fontes (novembro de 2026)

- Supabase — preços e cotas de Auth: <https://supabase.com/pricing>
- Supabase — e-mail padrão restrito desde 26/09/2024 e SMTP próprio no plano grátis (resumos de terceiros):
  <https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/>,
  <https://makerkit.dev/blog/saas/supabase-pricing>
- Clerk — plano grátis de 50 mil MRU: <https://clerk.com/changelog/2026-02-05-new-plans-more-value>
- Clerk Billing — sem suporte no Brasil: <https://clerk.com/docs/guides/billing/overview>
- Comparativos de auth (Auth0 25 mil MAU, Kinde, outros):
  <https://devtoolpicks.com/blog/clerk-vs-auth0-vs-supabase-auth-indie-hackers-2026>,
  <https://agentdeals.dev/alternative-to/clerk>, <https://toolradar.com/compare/clerk-vs-kinde>
- Firebase — preços e limites do Spark: <https://firebase.google.com/pricing>,
  <https://www.activepieces.com/blog/firebase-pricing-2026-plans-costs-and-free-limits.md>,
  <https://costbench.com/software/database-as-service/firestore/free-plan/>
- InstantDB — planos: <https://toolradar.com/tools/instantdb/pricing>, <https://www.stork.ai/en/instantdb>
- PowerSync — planos: <https://toolradar.com/tools/powersync>, <https://toolradar.com/compare/supabase-realtime-vs-powersync>
- Convex — planos: <https://www.activepieces.com/blog/how-to-choose-a-convex-pricing-plan-in-2026.md>,
  <https://costbench.com/software/database-as-service/convex/free-plan/>
- Appwrite × PocketBase: <https://toolradar.com/compare/appwrite-vs-pocketbase>,
  <https://uibakery.io/blog/supabase-alternatives>
