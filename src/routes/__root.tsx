import { useEffect } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute, redirect } from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { AuthContext } from '../auth/session-context'
import { BottomNav } from '../components/BottomNav'
import { fetchSession } from '../server/functions/session'

const SITE_URL = (process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const SITE_TITLE = 'CarrinhoSmart — carrinho inteligente e controle de orçamento'
const SITE_DESCRIPTION =
  'Bipe produtos, acompanhe o gasto em tempo real contra sua meta, gerencie a lista de compras e feche a compra com recibo e resumo por categoria.'

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
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },
      { name: 'theme-color', content: '#006c49' },
      { name: 'application-name', content: 'CarrinhoSmart' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'CarrinhoSmart' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },

      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'CarrinhoSmart' },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:image', content: `${SITE_URL}/og.png` },
      { property: 'og:image:secure_url', content: `${SITE_URL}/og.png` },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      {
        property: 'og:image:alt',
        content: 'CarrinhoSmart — bipe, controle e economize no mercado',
      },
      { property: 'og:locale', content: 'pt_BR' },

      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SITE_TITLE },
      { name: 'twitter:description', content: SITE_DESCRIPTION },
      { name: 'twitter:image', content: `${SITE_URL}/og.png` },
      {
        name: 'twitter:image:alt',
        content: 'CarrinhoSmart — bipe, controle e economize no mercado',
      },
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
