import { useEffect } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute, redirect } from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { AuthContext } from '../auth/session-context'
import { BottomNav } from '../components/BottomNav'
import { fetchSession } from '../server/functions/session'

const PUBLIC_PATHS = ['/login', '/signup']

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const isApi = location.pathname.startsWith('/api')
    if (isApi) return { user: null }

    const user = await fetchSession()
    const isPublic = PUBLIC_PATHS.includes(location.pathname)

    if (!user && !isPublic) {
      throw redirect({ to: '/login' })
    }
    if (user && isPublic) {
      throw redirect({ to: '/' })
    }

    return { user }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover',
      },
      { title: 'CarrinhoSmart' },
      {
        name: 'description',
        content: 'Carrinho inteligente e controle de orçamento de supermercado.',
      },
      { name: 'theme-color', content: '#006c49' },
      { name: 'application-name', content: 'CarrinhoSmart' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'CarrinhoSmart' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  const { user } = Route.useRouteContext()

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return (
    <AuthContext.Provider value={user}>
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-surface">
        <Outlet />
        <BottomNav />
      </div>
    </AuthContext.Provider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
