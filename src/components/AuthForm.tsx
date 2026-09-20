import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'
import { Icon } from './Icon'
import { Logo } from './Logo'

type Mode = 'signin' | 'signup'

const ERROR_MESSAGES: Record<string, string> = {
  'User already exists': 'Já existe uma conta com este e-mail.',
  USER_ALREADY_EXISTS: 'Já existe uma conta com este e-mail.',
  'Invalid email or password': 'E-mail ou senha inválidos.',
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha inválidos.',
  'Password too short': 'A senha deve ter ao menos 8 caracteres.',
  PASSWORD_TOO_SHORT: 'A senha deve ter ao menos 8 caracteres.',
  'Invalid email': 'Informe um e-mail válido.',
  INVALID_EMAIL: 'Informe um e-mail válido.',
}

function friendlyError(message?: string): string {
  if (!message) return 'Não foi possível concluir. Tente novamente.'
  return ERROR_MESSAGES[message] ?? message
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = isSignup
        ? await authClient.signUp.email({ email, password, name: name.trim() })
        : await authClient.signIn.email({ email, password })

      if (result.error) {
        setError(friendlyError(result.error.message))
        return
      }

      await router.invalidate()
      await router.navigate({ to: '/' })
    } catch {
      setError('Não foi possível conectar. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface px-4 py-10">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary-container/15 blur-3xl" />
      <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-secondary-container/15 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
              {isSignup ? 'Criar sua conta' : 'Bem-vindo de volta'}
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {isSignup
                ? 'Comece a controlar seu carrinho e seu orçamento.'
                : 'Entre para continuar suas compras.'}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-[0_4px_24px_rgba(15,23,42,0.08)]"
        >
          {isSignup && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Nome
              </span>
              <div className="relative">
                <Icon
                  name="person"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
                />
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Como podemos te chamar?"
                  className="h-12 w-full rounded-xl bg-surface-container-low pl-10 pr-3 text-sm text-on-surface outline-none placeholder:text-outline/70 focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
              E-mail
            </span>
            <div className="relative">
              <Icon
                name="mail"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
              />
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@email.com"
                className="h-12 w-full rounded-xl bg-surface-container-low pl-10 pr-3 text-sm text-on-surface outline-none placeholder:text-outline/70 focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Senha
            </span>
            <div className="relative">
              <Icon
                name="lock"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
              />
              <input
                required
                type="password"
                minLength={8}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
                className="h-12 w-full rounded-xl bg-surface-container-low pl-10 pr-3 text-sm text-on-surface outline-none placeholder:text-outline/70 focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-error-container p-3 text-on-error-container">
              <Icon name="error" className="text-[18px]" />
              <span className="text-xs font-medium">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container text-sm font-bold text-on-primary shadow-[0_4px_16px_rgba(16,185,129,0.3)] transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Icon name="progress_activity" className="animate-spin text-[20px]" />
                {isSignup ? 'Criando conta...' : 'Entrando...'}
              </>
            ) : (
              <>
                <Icon name={isSignup ? 'person_add' : 'login'} className="text-[20px]" />
                {isSignup ? 'Criar conta' : 'Entrar'}
              </>
            )}
          </button>

          <p className="text-center text-xs text-on-surface-variant">
            {isSignup ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
            <Link
              to={isSignup ? '/login' : '/signup'}
              className="font-bold text-primary hover:underline"
            >
              {isSignup ? 'Entrar' : 'Criar agora'}
            </Link>
          </p>
        </form>

        {!isSignup && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-secondary-fixed/40 p-3">
            <Icon name="lightbulb" className="text-[18px] text-on-secondary-container" />
            <p className="text-[11px] text-on-surface-variant">
              Quer dados de demonstração? Rode <code className="font-semibold">npm run seed</code> e
              entre com <strong className="text-on-surface">demo@carrinhosmart.dev</strong> /{' '}
              <strong className="text-on-surface">demo12345</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
