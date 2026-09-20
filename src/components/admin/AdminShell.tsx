import { useState, type ReactNode } from 'react'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { useAuthUser } from '../../auth/session-context'
import { authClient } from '../../lib/auth-client'
import { Icon } from '../Icon'
import { Logo } from '../Logo'

const NAV = [
  { to: '/admin', label: 'Visão geral', icon: 'dashboard', exact: true },
  { to: '/admin/lojas', label: 'Lojas', icon: 'storefront', exact: false },
  { to: '/admin/produtos', label: 'Produtos', icon: 'inventory_2', exact: false },
  { to: '/admin/categorias', label: 'Categorias', icon: 'category', exact: false },
  { to: '/admin/usuarios', label: 'Usuários', icon: 'group', exact: false },
] as const

export function AdminShell({ children }: { children: ReactNode }) {
  const user = useAuthUser()
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [signingOut, setSigningOut] = useState(false)

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
      await router.invalidate()
      await router.navigate({ to: '/login' })
    } finally {
      setSigningOut(false)
    }
  }

  const navLinks = (compact: boolean) => (
    <nav className={compact ? 'flex gap-1 overflow-x-auto' : 'flex flex-col gap-1'}>
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
            isActive(item)
              ? 'bg-primary-container/15 text-primary'
              : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          <Icon name={item.icon} className="text-[20px]" filled={isActive(item)} />
          {item.label}
        </Link>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-surface-container-low text-on-surface">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-outline-variant/30 bg-surface-container-lowest p-4 md:flex">
        <Link to="/admin" className="mb-6 flex items-center gap-2 px-2">
          <Logo compact />
          <div>
            <div className="text-sm font-extrabold">CarrinhoSmart</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Admin
            </div>
          </div>
        </Link>
        {navLinks(false)}
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            Voltar ao app
          </Link>
          <div className="rounded-xl bg-surface-container-low p-3">
            <div className="truncate text-xs font-bold text-on-surface">
              {user?.name ?? 'Admin'}
            </div>
            <div className="truncate text-[11px] text-on-surface-variant">{user?.email ?? ''}</div>
            <button
              type="button"
              disabled={signingOut}
              onClick={handleSignOut}
              className="mt-2 flex items-center gap-1 text-[11px] font-bold text-error disabled:opacity-60"
            >
              <Icon name="logout" className="text-[16px]" />
              {signingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 border-b border-outline-variant/30 bg-surface-container-lowest/90 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="mb-2 flex items-center justify-between">
            <Logo compact />
            <button type="button" onClick={handleSignOut} className="text-xs font-bold text-error">
              Sair
            </button>
          </div>
          {navLinks(true)}
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
