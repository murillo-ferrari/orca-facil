import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

const EDITIONS = ['local', 'cloud'] as const

export default defineConfig(({ mode }) => {
  // Edição do app (docs/plano-versao-cloud.md, seção 4.3). Padrão: local.
  const edition = loadEnv(mode, process.cwd(), 'VITE_').VITE_EDITION || 'local'
  if (!EDITIONS.includes(edition as (typeof EDITIONS)[number])) {
    throw new Error(`VITE_EDITION inválida: "${edition}". Use "local" ou "cloud".`)
  }
  if (edition === 'cloud') {
    throw new Error('A edição cloud ainda não foi implementada (fases F3 em diante do plano).')
  }

  return {
    // base relativa: o build funciona em qualquer subpasta (GitHub Pages, Netlify, etc.)
    base: './',
    plugins: [react(), tailwindcss()],
    // Garante o valor padrão também quando a variável não foi definida
    define: { 'import.meta.env.VITE_EDITION': JSON.stringify(edition) },
    // A lib de PDF é grande, mas só é carregada sob demanda
    build: { chunkSizeWarningLimit: 1500 },
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'node',
      // Testes que usam localStorage declaram `// @vitest-environment happy-dom` no topo
    },
  }
})
