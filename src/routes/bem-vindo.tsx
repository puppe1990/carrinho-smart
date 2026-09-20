import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import { dismissWelcome, fetchOnboarding, startWithDemoData } from '../server/functions/onboarding'

export const Route = createFileRoute('/bem-vindo')({
  loader: () => fetchOnboarding(),
  component: WelcomePage,
})

function WelcomePage() {
  const state = Route.useLoaderData()
  const router = useRouter()
  const [loading, setLoading] = useState<'empty' | 'demo' | null>(null)

  async function choose(action: 'empty' | 'demo') {
    setLoading(action)
    try {
      if (action === 'demo') {
        await startWithDemoData()
      }
      await dismissWelcome()
      await router.invalidate()
      await router.navigate({ to: '/' })
    } finally {
      setLoading(null)
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
              Sua conta está pronta
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {state.storeName
                ? `Catálogo com ${state.productCount} produtos em ${state.storeName}.`
                : 'Catálogo pronto para uso.'}
            </p>
          </div>
        </div>

        {state.isEmpty ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => choose('empty')}
              className="flex flex-col items-start gap-1 rounded-2xl border-2 border-primary-container bg-primary-fixed/20 p-4 text-left shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
                <Icon name="playlist_add" className="text-[22px] text-primary" />
                Começar do zero
              </span>
              <span className="text-xs text-on-surface-variant">
                Monte sua lista e bipe seus produtos. Nenhum dado é criado automaticamente.
              </span>
              {loading === 'empty' && (
                <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-primary">
                  <Icon name="progress_activity" className="animate-spin text-[14px]" />
                  Preparando...
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={loading !== null}
              onClick={() => choose('demo')}
              className="flex flex-col items-start gap-1 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
                <Icon name="auto_awesome" className="text-[22px] text-secondary-container" />
                Explorar com dados de exemplo
              </span>
              <span className="text-xs text-on-surface-variant">
                Cria uma lista, um carrinho e um histórico fictícios só para você conhecer o app.
              </span>
              {loading === 'demo' && (
                <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-secondary">
                  <Icon name="progress_activity" className="animate-spin text-[14px]" />
                  Gerando dados de exemplo...
                </span>
              )}
            </button>

            <p className="text-center text-[11px] text-on-surface-variant">
              Você pode apagar os dados de exemplo a qualquer momento em “Limpar tudo” no carrinho.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
            <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
              <Icon name="check_circle" className="text-[22px] text-primary" filled />
              Tudo pronto
            </span>
            <p className="text-xs text-on-surface-variant">
              Sua lista, carrinho e histórico estão disponíveis.
            </p>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => choose('empty')}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary-container text-sm font-bold text-on-primary disabled:opacity-60"
            >
              Continuar para o carrinho
              <Icon name="arrow_forward" className="text-[20px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
