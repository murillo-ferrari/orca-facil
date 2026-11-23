# CLAUDE.md — Orçafácil (gerador de orçamentos)

App web para profissionais autônomos criarem orçamentos de serviços e exportarem em PDF. Roda **100% no navegador**:
sem backend, sem login; os dados ficam no `localStorage`. O `README.md` é a documentação para pessoas (funcionalidades,
estrutura de pastas arquivo por arquivo, diagramas Mermaid). Este arquivo guarda o contexto para continuar o trabalho.

O nome "Orçafácil" (aparece em `src/App.tsx` e `index.html`) será publicado em `orcafacil.murilloferrari.tech` (subdomínio no Cloudflare).
Licença: AGPL-3.0 (`LICENSE`). Repositório público: <https://github.com/murillo-ferrari/orca-facil> (a pasta local
ainda se chama `gerador-orcamento`). Edição Local publicada em <https://murillo-ferrari.github.io/orca-facil/>.
Commits com o e-mail pessoal do usuário, por escolha dele.

## Stack e comandos

React 19 · Vite 8 · TypeScript 7 · Tailwind CSS 4 (`@tailwindcss/vite`) · zustand 5 (estado + `persist`) ·
react-router-dom 7 (`HashRouter`) · react-day-picker 10 (calendário, locale `pt-BR`) · date-fns 4 ·
@react-pdf/renderer 4.9 (PDF) · lucide-react (ícones) · fonte Inter via `@fontsource-variable/inter` (servida pelo
app, sem Google Fonts). Testes: Vitest 5 + happy-dom. Node 24.

```bash
npm run dev            # http://localhost:5173 (nas sessões usamos --port 5180 --strictPort)
npm test               # Vitest (npm run test:watch para modo contínuo)
npm run check          # o mesmo que o CI: format:check + lint + typecheck + test
npm run build          # tsc -b && vite build → dist/ (estático, caminhos relativos)
npm run format         # Prettier: sem ponto e vírgula, aspas simples, 120 colunas
npm run lint           # oxlint --deny-warnings (qualquer aviso reprova o CI)
```

- `VITE_EDITION` (`local` | `cloud`, padrão `local`) escolhe a edição no build; `vite.config.ts` valida e hoje
  **recusa `cloud`** até a edição existir. CI em `.github/workflows/ci.yml`; publicação em `.github/workflows/pages.yml`.

## Testes e validação

- **Vitest:** testes `*.test.ts` ao lado do código (`lib/`, `data/`, `store/`, `reports/`, `pdf/`,
  `lib/parseBRNumber`). Ambiente `node` por padrão; arquivos que precisam de `localStorage` começam com
  `// @vitest-environment happy-dom`. Rode `npm run check` antes de considerar algo pronto.
- Os testes independem do fuso horário (verificados de UTC−11 a UTC+14); mantenha assim (datas `yyyy-MM-dd` e ISO
  com hora local explícita nos cenários).
- `reports/data.test.ts` tem um cenário de resultado conhecido (orçamentos A–G); amplie-o ao mudar regras de relatório.
- `pdf/QuotePdf.test.ts` conta páginas do PDF gerado (regressões de paginação/layout). Conteúdo visual do PDF ainda se
  confere gerando o arquivo e convertendo para imagem (`qlmanage -t` no macOS, ou PDFKit via Swift para outras páginas).
- **Telas:** navegador (Claude in Chrome), semeando dados com `await import('/src/store/store.ts')` +
  `useStore.setState(...)` no console da página. Para simular celular quando a janela não redimensiona: iframe de
  390px da própria URL dentro da página.
- Depois de testar, **apagar os dados de teste** (`localStorage.removeItem('gerador-orcamento:v1')` e
  `sessionStorage.removeItem('gerador-orcamento:filtros-relatorios')`) e encerrar o servidor.
- Evitar baixar vários PDFs pelo navegador: o Chrome bloqueia downloads automáticos repetidos e os arquivos
  vão para `~/Downloads` do usuário. Prefira gerar o PDF via Node.
- Nunca clicar em "Imprimir / PDF" na automação: `window.print()` abre um diálogo que trava a extensão.

## Convenções

- **Idioma:** toda a interface, comentários e documentação em **português do Brasil com acentuação correta**.
  Identificadores de código em inglês.
- **UI:** usar os componentes de `src/components/ui.tsx` (`Button`, `Input`, `Select`, `Field`, `TextField`, `Card`,
  `CardHeader`, `Modal`, `Segmented`, `EmptyState`, `Badge`); `cn` e `inputClass` vêm de `components/styles.ts`.
  Cores da marca: tokens `brand-*` em `src/index.css`. Notificações com `toast()` de `components/toast.ts` (exibidas
  pelo `<Toaster/>`). Confirmações destrutivas com `window.confirm`.
- **Arquivos `.tsx` exportam só componentes** (regra de _fast refresh_ do lint): funções e constantes compartilhadas
  vão para `.ts` próprios (ex.: `styles.ts`, `toast.ts`, `reports/describeFilters.ts`, `lib/format.ts`).
- **Renderização pura:** nada de `new Date()`/`Math.random()` no corpo do componente; use `useState(() => …)`,
  eventos ou efeitos.
- **Responsivo:** pensado para celular. Barra inferior com 6 itens (`App.tsx`); barras de ação fixas ficam acima dela
  (ex.: `bottom-[57px]` no editor de orçamento) e descem para `bottom-0` a partir de `lg`. O editor de itens usa **container queries** (`@container` /
  `@3xl:`), não breakpoints de tela, porque sua largura depende do layout.
- **Dinheiro:** `number` em reais; arredondar com `round2` (`lib/calc.ts`); exibir com `formatCurrency`; editar com
  `NumberInput` (aceita "1.234,56" e "1234.56"; seleciona o conteúdo ao focar).
- **Datas:** datas de calendário como string `yyyy-MM-dd` (`issueDate`, `validUntil`); instantes como ISO datetime
  (`createdAt`, `updatedAt`, `statusHistory[].at`). Use `parseDate`, `toISODate`, `formatDate` de `lib/format.ts`.
  Ao comparar `statusHistory[].at` com datas de calendário, converter para data local (ver `statusDate` em
  `reports/data.ts`).
- **Impressão:** elementos que não devem sair no papel levam `print:hidden`.
- **Commits e push:** só quando o usuário pedir. Branch `main`, remoto `origin` no GitHub. Push na `main` dispara o
  CI (`ci.yml`) e a publicação no GitHub Pages (`pages.yml`, que só publica se `npm run check` passar).

## Boas práticas da web (Modern Web Guidance)

- **Antes de criar ou alterar interface** (JSX, CSS/Tailwind, JS do navegador), use a skill do projeto
  `.claude/skills/modern-web-guidance/SKILL.md`: `npm run -s mwg -- search "<capacidade em inglês>"` e
  `npm run -s mwg -- retrieve "<id>"`. Versão fixa em `devDependencies`; os scripts desligam a telemetria.
- **Política de navegadores:** Baseline **amplamente disponível** sem fallback; recursos recentes ou limitados só
  com detecção + alternativa simples (≤ ~20 linhas, sem polyfill/nova dependência). Senão, registrar em Pendências.
- Já aplicado (18/11/2026): `toSorted`/`findLast`; `Modal` com `aria-labelledby`, `closedby="any"` + fallback por
  coordenadas (Safari) e `overscroll-behavior` no `dialog`/`::backdrop`; mensagem de campo ligada por
  `aria-describedby` (`fieldMessageId`); `autocomplete` nos dados **do próprio usuário** (perfil da empresa,
  `AddressFields ownData`) e `off` nos dados de **clientes**; `aria-sort` só na coluna ordenada + `role="status"`
  anunciando a ordenação, tabela em região rolável nomeada (`DataTable` exige `label`); animações de movimento só
  com `motion-safe:`; região "Notificações" para os toasts e toasts disparados só depois de fechar modais.
- **Padrões a seguir:** modal = `<Modal>` (nunca `role="dialog"`/`aria-modal`/focus trap manuais); dados de terceiros
  com `autoComplete="off"`; nada de `overflow: hidden` no `body` para travar rolagem; movimento novo dentro de
  `motion-safe:` (ou `@media (prefers-reduced-motion: no-preference)`); `npm run -s mwg:scan` deve continuar só com os
  2 falsos positivos conhecidos (cópia de `Map` em `reports/data.ts`).

## Modelo de dados e persistência

Tipos em `src/types.ts`. Formato dos dados (`DataState`: `profiles`, `activeProfileId`, `clients`, `units`, `catalog`,
`quotes`) em `src/data/schema.ts`. Ações em `src/store/store.ts` (zustand). **Onde** os dados ficam vem da edição:
`src/editions/index.ts` → `src/editions/local/persistence.ts` (localStorage). A edição Cloud vai plugar a própria
persistência ali (contrato `DataPersistence` em `src/data/persistence.ts`), sem mudar telas nem ações.

- Chave do `localStorage`: **`STORAGE_KEY = 'gerador-orcamento:v1'` — nome fixo, nunca renomear** (apagaria os dados
  dos usuários).
- Versão do formato: **`SCHEMA_VERSION`** (hoje **2**), em `data/schema.ts`. Para mudar o formato: incrementar, tratar a
  conversão em `migrateState` (e em `normalizeQuote`, de `store/factories.ts`, se for campo de orçamento) e cobrir em
  `data/schema.test.ts`. O persist só grava os dados (`partialize: pickData`).
- Importação de backup: `parseBackup` (valida o arquivo, `data/backup.ts`) → `importData` → `normalizeImport` (migra,
  restaura unidades padrão se vazias, escolhe a empresa ativa).
- Campo novo em orçamento/item: atualizar `types.ts`, a fábrica correspondente (`newQuote`, `newItem`…) e
  `normalizeQuote`.
- v2 adicionou:
  - `Quote.statusHistory: { status, at }[]` — `updateQuote` registra automaticamente quando `status` muda; orçamentos
    novos e duplicados começam com `[{ status: 'rascunho' }]`; dados migrados ficam com `[]`.
  - `QuoteItem.catalogId: string | null` — preenchido ao escolher item do catálogo (sugestão ou seletor) e ao
    "Salvar no catálogo"; apagar a descrição desfaz o vínculo; editar a descrição mantém.
- `Quote.client` é uma **cópia** dos dados do cliente no momento do orçamento (`clientId` aponta para o cadastro,
  ou `null` se digitado à mão). Editar o cadastro não altera orçamentos antigos.
- Backup: _Ajustes_ exporta `{ app, version: 1, schemaVersion, exportedAt, data }` em JSON (`createBackup`); importar
  **substitui** tudo. Arquivos sem envelope (só o estado) também são aceitos.

## Banco da edição Cloud (F3, `supabase/`)

- Migrações em `supabase/migrations/` (SQL comentado em pt-BR). **Depois que uma migração for aplicada num ambiente
  online, nunca editá-la: criar uma nova.** Enquanto só existir localmente, pode ser editada + `npm run db:reset`.
- Tabelas: `user_settings` (1 por usuário, `id = user_id`), `company_profiles`, `clients`, `catalog_items`, `quotes`
  (documento completo em `data` + colunas extraídas), `plan_limits`, `subscriptions`, `billing_events`.
- Colunas de controle definidas pelo servidor: `user_id` (de `auth.uid()`), `rev`, `inserted_at`, `updated_at`;
  `deleted_at` = exclusão lógica. Usuários não fazem DELETE físico; excluir a conta apaga tudo em cascata.
- RPCs do app: `aplicar_alteracoes`, `buscar_alteracoes`, `reservar_numeros_orcamento`, `definir_proximo_numero`,
  `uso_do_plano`. Auxiliares `security definer` ficam no schema `private` (não exposto pela API).
- Limites (grátis: 15 orçamentos novos/mês, 1 empresa) na tabela `plan_limits`; aplicados nas policies de INSERT.
- Testes: `npm run db:test` (78 pgTAP, também no CI). Ao mudar o banco: migração + teste + `npm run db:types`
  (o CI falha se `src/editions/cloud/database.types.ts` estiver desatualizado). Nos testes, para mexer em colunas
  protegidas por gatilho, usar `set local session_replication_role = replica`.
- Projeto online vinculado: `orca-facil` (staging, ref `tqysyqwzqyuiwbudnfqc`). CLI v3: comandos remotos exigem
  `--remote` (ex.: `npx supabase db push --remote --dry-run` antes de aplicar); sem ele, o alvo é o banco local.
- Docker Desktop precisa estar rodando. Container do banco: `supabase_db_orca-facil` (porta 54322).

## Regras de negócio

- **Numeração:** por perfil de empresa, `prefixo + número com 4 dígitos` (`ORC-0001`). `createQuote` e
  `duplicateQuote` reservam o próximo número; duplicar volta o status para rascunho e reinicia o histórico.
- **Novo orçamento:** usa validade, forma de pagamento e observações padrão do perfil. Mudar a data de emissão
  desloca a validade mantendo a mesma quantidade de dias. Atalhos de validade: 7/15/30/60 dias.
- **Totais (`quoteTotals`):** subtotal dos itens − desconto (% limitado a 0–100, ou valor) + acréscimos; total nunca
  negativo.
- **Orçamentos de um cliente (`lib/clientQuotes.ts`):** vinculados pelo `clientId`; sem vínculo, contam se o
  CPF/CNPJ for igual. Só o nome não basta (evita misturar homônimos). Os relatórios usam a mesma regra
  (`makeClientKeyOf`), com fallback para documento e depois nome normalizado.
- **Taxa de aprovação:** aprovados ÷ enviados, em que "enviado" = qualquer status exceto rascunho. (A fórmula
  antiga, aprovados ÷ (aprovados + recusados), foi descartada por inflar a taxa.)
- **Vencido:** status `enviado` com `validUntil` anterior a hoje.

## Relatórios (`src/reports/`, rota `/relatorios` e `/relatorios/:tab`)

Abas: Visão geral, Follow-up (`follow-up`), Clientes (`clientes`), Serviços (`servicos`), Descontos (`descontos`).

- **Filtros** (`FilterBar`): empresa (padrão: a ativa; opção "todas"), período por **data de emissão**
  (padrão: últimos 12 meses), status, cliente, serviço, valor mínimo/máximo. Guardados no `sessionStorage`
  (`gerador-orcamento:filtros-relatorios`) e compartilhados entre as abas. Recolhidos no celular.
- **Base de datas:** os números são uma coorte dos orçamentos **emitidos no período**. Exceções que usam a
  **data de aprovação** (do `statusHistory`, com fallback na emissão): série "Aprovado" do gráfico mensal e a linha
  "fechados no período". Ambas estão rotuladas na tela.
- **Follow-up** ignora período e status (mostra todos os `enviado`): vencidos, vencendo em N dias (7/15/30) e demais.
  Botão _Cobrar_ abre `https://wa.me/55<telefone>` com mensagem pronta; botões marcam aprovado/recusado.
- **Serviços:** agrupa por `cat:<catalogId>` ou `txt:<descrição normalizada>` (sem acentos, minúsculas, espaços
  únicos); considera só enviados; valores dos itens **antes** de desconto/acréscimo; compara preço médio praticado
  com o preço atual do catálogo.
- **CSV** (`csv.ts`): separador `;`, vírgula decimal, BOM UTF-8 (formato do Excel em português). Colunas vêm do
  `DataTable`; `csvOnly` = só no CSV, `screenOnly` = só na tela.
- **Gráfico** (`MonthlyChart.tsx`, SVG próprio, sem biblioteca): duas séries com a paleta categórica validada
  `#2a78d6` (Orçado) e `#eb6834` (Aprovado) — passou no validador de daltonismo/contraste. Barras ≤ 24px, topo
  arredondado, legenda, tooltip por mês e alternativa em tabela. Não usar cores de status (verde/vermelho) como série.

## PDF (`src/pdf/`)

`@react-pdf/renderer` é carregado **sob demanda** (`import()` em `exportPdf.ts`, ~1,2 MB). Layout fixo e sóbrio,
sem logo e sem área de assinatura (escolhas do usuário). Nome do arquivo: `Orcamento-<numero>-<cliente>.pdf`.
Armadilhas já resolvidas em `QuotePdf.tsx` — não reintroduzir:

- `lineHeight` nunca na `Page` nem em `View`; só em estilos de `Text` que também definem `fontSize`
  (senão a numeração de páginas some ou surgem espaçamentos enormes).
- `Text` com `render` (numeração) precisa de `left` + `right` e de um filho inicial `' '`.
- `View` absoluta e `fixed` precisa de `height`; `Text` absoluto não pode ter `height`.
- Hifenização automática desligada (`Font.registerHyphenationCallback`).
- Fonte Helvetica padrão (cobre acentos, `m²`, `m³`).

## Serviços externos

Os dados dos orçamentos nunca saem do navegador. Contatos externos: **ViaCEP** (só o CEP digitado) e **WhatsApp** (só
quando o usuário clica em _Cobrar_). A fonte é servida pelo próprio app desde a F1 (antes vinha do Google Fonts).

## Pendências e pontos em aberto

- Os cards "Aguardando" da lista de orçamentos e da página do cliente **incluem enviados já vencidos**. Foi
  proposto separar os vencidos ("+N vencidos"); o usuário ainda não decidiu.
- O layout de impressão dos relatórios não foi conferido visualmente (o diálogo de impressão trava a automação).
- **Modern Web Guidance — adiado pela política de navegadores:**
  - Menus (`RowMenu` do editor de itens) e o calendário (`DateField`) como **Popover API** (`popover="auto"` +
    `command`/`commandfor`), navegação por setas com **`focusgroup`** e posição com **anchor positioning** (guias
    `menu`, `viewport-aware-dropdowns`). Popover é Baseline recente (jan/2025), `focusgroup` só no Chrome e anchor
    positioning sem Firefox: hoje exigiriam polyfills. Reavaliar quando ficarem amplamente disponíveis.
  - Notificações com `ariaNotify()` e `popover="manual"` (guia `persistent-toast-notifications`): Baseline só desde
    set/2026; o `aria-live` atual é o fallback indicado pelo guia.
  - Tabelas como cartões em telas estreitas (guia `responsive-table`); hoje há rolagem horizontal acessível.
  - Tema escuro (guias de UX) e animação de abertura de modal/popover (`animate-to-from-top-layer`).

## Roadmap

Ideia do usuário em duas etapas, detalhada em **`docs/plano-versao-cloud.md`** (ler antes de trabalhar nisso):

1. **Edição Local pública:** repositório público + build no GitHub Pages; qualquer um usa ou clona.
2. **Edição Cloud:** login obrigatório e dados sincronizados entre dispositivos, com planos pagos.
   **Decidido (18/11/2026): Supabase para tudo** — banco Postgres com RLS (`auth.uid()`), **Supabase Auth** (código
   de 6 dígitos por e-mail + Google, telas próprias em pt-BR, SMTP próprio obrigatório), Realtime e Edge Functions,
   na região São Paulo. **O Clerk foi descartado**: o Clerk Billing não funciona no Brasil, e só o login não
   justificava um segundo fornecedor. Cobrança por provedor brasileiro (ex.: Asaas); o plano fica na tabela
   `subscriptions`. Sincronização offline com motor próprio; **PowerSync** é o plano B. Supabase Free pausa após
   7 dias sem uso, então produção vai no Pro.
   Comparativo em `docs/avaliacao-autenticacao-e-backend.md`.

Decididas: **D1 licença AGPL-3.0**, **D2 código da Cloud no mesmo repositório público** (edição escolhida por
`VITE_EDITION`), **D3 domínio `orcafacil.murilloferrari.tech`** (trocado em 23/11/2026; e-mail de login
`login@orcafacil.murilloferrari.tech`), **D10 Resend** (SMTP). Pendentes: D4 pagamento, D5 planos, D6 login, D7 offline,
D8 conflitos, D9 nome (tende a "Orçafácil") — ver seção 2 do plano.

## Histórico (resumo)

1. Commit inicial: perfis de empresa, clientes, catálogo, unidades, editor de orçamento, PDF, backup.
2. Página do cliente com histórico de orçamentos; correção da taxa de aprovação.
3. Aba de relatórios (5 relatórios, filtros, CSV, impressão) + `statusHistory` e `catalogId` (schema v2).
4. README com estrutura detalhada e dois diagramas Mermaid (funcionamento e fluxo de dados).
5. Correções do README apontadas no /code-review, CLAUDE.md e plano da edição Cloud em `docs/`.
6. Reavaliação de autenticação/backend: Supabase Auth no lugar do Clerk; plano atualizado.
7. **F1 (fundação) concluída:** Vitest (95 testes), camada `src/data/` + `src/editions/`, `VITE_EDITION`, fonte
   Inter local, CI e scripts `test`/`check`/`format`.
8. **F2:** repositório público, LICENSE, GitHub Pages; lint estrito (`--deny-warnings`).
9. **F3 (banco) concluída localmente:** migrações, RLS, planos, sincronização, 78 testes pgTAP, tipos gerados.
   Projeto `staging` online (`orca-facil`, ref `tqysyqwzqyuiwbudnfqc`) com as migrações aplicadas em 23/11/2026.
10. **Modern Web Guidance incorporado:** skill do projeto, scripts `mwg`, política de navegadores e correções de
   acessibilidade/modernização (ver seção própria).
11. **F4 (autenticação) — código pronto:** login por código e Google, Turnstile, conta em Ajustes, `delete-account`,
    modelo de e-mail; testado no banco local. Falta configurar o projeto online (ver item 5 da seção 17 do plano).
