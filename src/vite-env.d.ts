/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Edição do app, definida no build (ver vite.config.ts). */
  readonly VITE_EDITION: 'local' | 'cloud'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
