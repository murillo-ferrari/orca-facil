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
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter((k) => !env[k])
    if (missing.length) throw new Error(`Edição cloud sem ${missing.join(', ')} (ver .env.example).`)
  }

  return {
    // Local: base relativa, funciona em qualquer subpasta (GitHub Pages etc.).
    // Cloud: rotas por caminho (BrowserRouter), então os arquivos precisam de caminho absoluto.
    base: edition === 'cloud' ? '/' : './',
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
