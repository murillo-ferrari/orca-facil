/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Edição do app, definida no build (ver vite.config.ts). */
  readonly VITE_EDITION: 'local' | 'cloud'
  /** Edição Cloud: chaves públicas do Supabase e do Turnstile (ver .env.example). */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
