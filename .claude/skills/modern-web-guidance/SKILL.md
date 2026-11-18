---
name: modern-web-guidance
description: |
  Consulta as boas práticas atuais da web (Modern Web Guidance, do Chrome/Firefox/Edge) antes de criar ou alterar
  interface neste projeto. Use SEMPRE no início de tarefas de HTML/JSX, CSS/Tailwind ou JS do navegador: modais,
  menus, popovers, formulários, validação, preenchimento automático, tabelas, animações, acessibilidade, datas,
  desempenho (LCP, INP, CLS), segurança (CSP, sanitização, passkeys) e tema claro/escuro.
  NÃO use para banco/SQL, Supabase, CI, scripts, testes ou configuração de ferramentas.
---

# Modern Web Guidance neste projeto

Ferramenta oficial ([GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance),
Apache-2.0) com guias verificados por especialistas, ligados aos dados de suporte dos navegadores (Baseline). Está
instalada como dependência de desenvolvimento com **versão fixa** e é chamada pelos scripts do `package.json`, que
**desligam a telemetria** (`DISABLE_TELEMETRY=1`).

## Fluxo

1. **Buscar** um guia por tarefa, com 2 a 5 palavras **em inglês**, descrevendo a capacidade da interface (sem nome
   de framework nem do domínio do app). Uma busca por capacidade:

   ```sh
   npm run -s mwg -- search "light dismiss dialog"
   ```

   Ex.: "pegar uma data" → `date picker input`; "confirmar antes de apagar" → `confirm dialog`. Se o resultado vier
   vazio ou fora do tema, reformule uma vez com o nome do componente (`dialog`, `popover`, `table`, `form`).

2. **Ler** o guia escolhido (e o guia geral da área, quando houver: `html`, `css`, `forms`, `accessibility`,
   `performance`, `security`):

   ```sh
   npm run -s mwg -- retrieve "dialog,accessibility"
   ```

   Saídas grandes são gravadas num arquivo temporário: leia o arquivo inteiro.

3. **Aplicar** respeitando a **política de navegadores** abaixo e adaptando ao React (refs para `showModal()`,
   `useId()` para ids, atributos ainda sem tipo no React via `{...({ closedby: 'any' } as object)}`).

4. **Conferir** o código contra o guia antes de concluir e **citar na resposta** quais guias (ids) orientaram as
   mudanças e o que cada um evitou.

Para varrer padrões antigos no código todo (cobre só ~20% do catálogo): `npm run -s mwg:scan`. Os 2 achados em
`reports/data.ts` (cópia de `Map` antes de ordenar) são falsos positivos conhecidos: manter.

## Política de navegadores

O público usa muito celular, inclusive iPhones com sistema não tão recente.

- **Baseline amplamente disponível** (há mais de ~2,5 anos nos principais navegadores): pode usar sem fallback.
- **Baseline recente** ou **disponibilidade limitada**: só com **detecção do recurso** e uma alternativa simples
  (até ~20 linhas, **sem polyfill nem nova dependência**). Se a alternativa não couber nisso, não adote o recurso
  agora: registre-o em "Pendências" no `CLAUDE.md`.
- Melhorias progressivas sem detecção possível (ex.: `overscroll-behavior` em contêiner sem rolagem) podem ser
  usadas quando a ausência não quebra nada.
