import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// base relativa: o build funciona em qualquer subpasta (GitHub Pages, Netlify, etc.)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // A lib de PDF é grande, mas só é carregada sob demanda
  build: { chunkSizeWarningLimit: 1500 },
})
