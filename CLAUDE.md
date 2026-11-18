# CLAUDE.md — Orçafácil (gerador de orçamentos)

App web para profissionais autônomos criarem orçamentos de serviços e exportarem em PDF. Roda **100% no navegador**:
sem backend, sem login; os dados ficam no `localStorage`. O `README.md` é a documentação para pessoas (funcionalidades,
estrutura de pastas arquivo por arquivo, diagramas Mermaid). Este arquivo guarda o contexto para continuar o trabalho.

O nome "Orçafácil" (aparece em `src/App.tsx` e `index.html`) acompanha o domínio `orcafacil.com.br`, em registro.
Licença: AGPL-3.0 (o arquivo `LICENSE` entra na publicação da etapa 1).

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
npm run lint           # oxlint (avisos only-export-components e purity são conhecidos)
```

- `VITE_EDITION` (`local` | `cloud`, padrão `local`) escolhe a edição no build; `vite.config.ts` valida e hoje
  **recusa `cloud`** até a edição existir. CI em `.github/workflows/ci.yml` (roda quando houver remoto no GitHub).

## Testes e validação

- **Vitest:** testes `*.test.ts` ao lado do código (`lib/`, `data/`, `store/`, `reports/`, `pdf/`,
  `components/NumberInput`). Ambiente `node` por padrão; arquivos que precisam de `localStorage` começam com
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
  `CardHeader`, `Modal`, `Segmented`, `EmptyState`, `Badge`, `cn`). Cores da marca: tokens `brand-*` definidos em
  `src/index.css`. Notificações com `toast()` de `components/toast.tsx`. Confirmações destrutivas com `window.confirm`.
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
- **Commits:** só quando o usuário pedir. Repositório na branch `main`, **sem remoto configurado**.

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
- Sem remoto Git (nada publicado).

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
`VITE_EDITION`), **D3 domínio `orcafacil.com.br`** (registro em andamento; app em `app.orcafacil.com.br`, e-mail de
login `login@orcafacil.com.br`). Pendentes: D4 pagamento, D5 planos, D6 login, D7 offline, D8 conflitos, D9 nome
(tende a "Orçafácil"), D10 SMTP — ver seção 2 do plano.

## Histórico (resumo)

1. Commit inicial: perfis de empresa, clientes, catálogo, unidades, editor de orçamento, PDF, backup.
2. Página do cliente com histórico de orçamentos; correção da taxa de aprovação.
3. Aba de relatórios (5 relatórios, filtros, CSV, impressão) + `statusHistory` e `catalogId` (schema v2).
4. README com estrutura detalhada e dois diagramas Mermaid (funcionamento e fluxo de dados).
5. Correções do README apontadas no /code-review, CLAUDE.md e plano da edição Cloud em `docs/`.
6. Reavaliação de autenticação/backend: Supabase Auth no lugar do Clerk; plano atualizado.
7. **F1 (fundação) concluída:** Vitest (95 testes), camada `src/data/` + `src/editions/`, `VITE_EDITION`, fonte
   Inter local, CI e scripts `test`/`check`/`format`.
