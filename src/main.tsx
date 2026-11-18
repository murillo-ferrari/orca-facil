import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonte servida pelo próprio app (sem chamadas ao Google Fonts); o navegador baixa só os alfabetos usados
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
