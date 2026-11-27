import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Button, Card, Field, Input } from '../../../components/ui'
import { fieldMessageId } from '../../../components/styles'
import { supabase } from '../supabase'
import { authErrorMessage } from './messages'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const RESEND_AFTER_MS = 60_000

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string
  remove(id: string): void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let turnstileScript: Promise<TurnstileApi> | undefined
function loadTurnstile() {
  turnstileScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve(window.turnstile!)
    s.onerror = reject
    document.head.append(s)
  })
  return turnstileScript
}

/** CAPTCHA do Cloudflare. Cada token vale para um envio: troque a `key` do componente para gerar outro. */
function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let id: string | undefined
    let cancelled = false
    loadTurnstile().then((t) => {
      if (cancelled || !ref.current) return
      id = t.render(ref.current, {
        sitekey: SITE_KEY,
        language: 'pt-br',
        callback: onToken,
        'expired-callback': () => onToken(''),
      })
    })
    return () => {
      cancelled = true
      if (id) window.turnstile?.remove(id)
    }
  }, [onToken])
  return <div ref={ref} className="min-h-[65px]" />
}

/** Logo do Google (as quatro cores da marca), decorativo: o botão já tem o texto. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" className="shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  // Erro do retorno do Google (ex.: o usuário cancelou), lido uma vez da URL
  const [error, setError] = useState(() => new URLSearchParams(location.search).get('error_description') ?? '')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)
  const [canResend, setCanResend] = useState(false)

  useEffect(() => {
    if (step !== 'code' || canResend) return
    const t = setTimeout(() => setCanResend(true), RESEND_AFTER_MS)
    return () => clearTimeout(t)
  }, [step, canResend])

  async function sendCode() {
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, captchaToken: captchaToken || undefined },
    })
    setBusy(false)
    // O token do CAPTCHA é de uso único: gera outro para o próximo envio
    setCaptchaToken('')
    setCaptchaKey((k) => k + 1)
    if (error) return setError(authErrorMessage(error))
    setStep('code')
    setCode('')
    setCanResend(false)
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
    setBusy(false)
    // Com sucesso, o AuthGate recebe a sessão e mostra o app
    if (error) setError(authErrorMessage(error))
  }

  async function google() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    if (error) setError(authErrorMessage(error))
  }

  const needsCaptcha = !!SITE_KEY && !captchaToken
  const errorEl = error && (
    <p role="alert" id={fieldMessageId('login')} className="text-sm text-red-600">
      {error}
    </p>
  )

  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-50 px-4 pt-[12vh] pb-10">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <FileText size={16} />
          </div>
          <span className="font-semibold tracking-tight text-slate-900">Orçafácil</span>
          <Link to="/" className="ml-auto text-sm text-slate-500 hover:text-slate-800">
            ← Início
          </Link>
        </div>

        {step === 'email' ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Entrar</h1>
            <p className="mt-1 mb-5 text-sm text-slate-600">
              Enviamos um código para o seu e-mail. No primeiro acesso, a conta é criada.
            </p>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                void sendCode()
              }}
            >
              <Field label="E-mail" htmlFor="login">
                <Input
                  id="login"
                  name="email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? fieldMessageId('login') : undefined}
                />
              </Field>
              {SITE_KEY && <Turnstile key={captchaKey} onToken={setCaptchaToken} />}
              {errorEl}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="justify-center"
                disabled={busy || needsCaptcha}
              >
                {busy ? 'Enviando…' : 'Enviar código'}
              </Button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs text-slate-400" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-200" /> ou <span className="h-px flex-1 bg-slate-200" />
            </div>
            <Button size="lg" className="w-full justify-center" onClick={google}>
              <GoogleMark />
              Continuar com Google
            </Button>
            <p className="mt-5 text-center text-xs text-slate-500">
              Ao entrar, você concorda com os{' '}
              <Link to="/termos" className="underline">
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link to="/privacidade" className="underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Digite o código</h1>
            <form className="mt-4 flex flex-col gap-4" onSubmit={verify}>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login" className="text-sm font-medium text-slate-700">
                  Código de acesso
                </label>
                {/* Dica acima do campo: o teclado do celular e o preenchimento automático não a cobrem */}
                <p id="login-hint" className="text-sm text-slate-600">
                  Enviamos um código de 6 dígitos para{' '}
                  {/* Em linha própria: só quebra no meio se o e-mail sozinho não couber (overflow-wrap:anywhere) */}
                  <strong className="block [overflow-wrap:anywhere]">{email.trim()}</strong>
                  Confira também a caixa de spam.
                </p>
                <Input
                  id="login"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="h-12 font-mono text-xl tracking-[0.35em]"
                  aria-invalid={!!error}
                  aria-describedby={error ? `login-hint ${fieldMessageId('login')}` : 'login-hint'}
                />
              </div>
              {errorEl}
              <Button type="submit" variant="primary" size="lg" className="justify-center" disabled={busy}>
                {busy ? 'Verificando…' : 'Entrar'}
              </Button>
            </form>
            {SITE_KEY && canResend && (
              <div className="mt-4">
                <Turnstile key={captchaKey} onToken={setCaptchaToken} />
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('email')}>
                Usar outro e-mail
              </Button>
              <Button variant="ghost" size="sm" disabled={!canResend || busy || needsCaptcha} onClick={sendCode}>
                {canResend ? 'Reenviar código' : 'Reenviar em 1 min'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </main>
  )
}
