# Orçafácil — gerador de orçamentos de serviços

Ferramenta web para profissionais autônomos criarem orçamentos e exportarem em PDF.
Tudo roda no navegador: não há servidor nem login, e os dados ficam salvos no `localStorage`.

## Funcionalidades

- **Perfis de empresa (vários):** CPF ou CNPJ (com máscara e validação), razão social, nome fantasia,
  IE/IM, endereço com preenchimento automático pelo CEP (ViaCEP), contatos, chave PIX e dados bancários.
  Cada perfil tem validade padrão, forma de pagamento e observações padrão, além de numeração própria (`ORC-0001`…).
- **Orçamentos:** itens com unidade configurável, quantidade, preço unitário e total calculado;
  desconto (% ou R$), acréscimos (frete, deslocamento…), forma de pagamento, prazo e observações.
  Salvamento automático, status (rascunho/enviado/aprovado/recusado), duplicar e excluir.
- **Datas:** calendário em pt-BR; validade com atalhos (7/15/30/60 dias) que acompanham a data de emissão.
- **Preenchimento rápido:** `Tab` passa por descrição → unidade → qtd → preço; `Enter` no preço cria o próximo item;
  a descrição sugere itens do catálogo enquanto você digita.
- **Clientes e catálogo de serviços** reutilizáveis, salvos direto do editor.
- **PDF** com layout sóbrio, gerado no navegador (a biblioteca só carrega na hora de gerar), com rodapé e numeração de páginas.
- **Backup:** exporte/importe todos os dados em JSON em _Ajustes_.

## Rodando

```bash
npm install
npm run dev      # desenvolvimento em http://localhost:5173
npm run build    # gera o site estático em dist/
```

O build usa caminhos relativos e rotas com `#`, então a pasta `dist/` funciona em qualquer hospedagem estática
(Netlify, Vercel, GitHub Pages) ou subpasta.

## Estrutura

```
src/
  types.ts              modelos de dados
  store/                estado global (zustand + persistência no localStorage) e fábricas
  lib/                  formatação/máscaras/validação BR, cálculos, CEP, status
  components/           UI base, campos (data, número, documento, endereço), editor de itens
  pages/                Orçamentos, Editor, Clientes, Serviços, Empresas, Ajustes
  pdf/                  documento PDF (@react-pdf/renderer) e exportação
```

### Notas sobre o PDF (@react-pdf/renderer)

Algumas armadilhas da biblioteca, já tratadas em `src/pdf/QuotePdf.tsx`:

- `lineHeight` não pode ficar na `Page` nem em `View`s; use-o apenas em estilos de `Text` que também definem `fontSize`.
- `Text` com `render` (numeração de páginas) precisa de `left` + `right` e de um conteúdo inicial (`' '`).
- `View` absoluta e `fixed` precisa de `height`; `Text` absoluto não pode ter `height`.
