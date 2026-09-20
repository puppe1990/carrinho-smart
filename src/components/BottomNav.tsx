import { Link, useRouterState } from '@tanstack/react-router'
import { Icon } from './Icon'

const HIDDEN_PREFIXES = ['/scanner', '/compra']

const ITEMS = [
  { to: '/', label: 'Carrinho', icon: 'shopping_cart' },
  { to: '/lista', label: 'Lista', icon: 'checklist' },
  { to: '/historico', label: 'Histórico', icon: 'receipt_long' },
  { to: '/resumo', label: 'Resumo', icon: 'insights' },
] as const

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null

  const left = ITEMS.slice(0, 2)
  const right = ITEMS.slice(2)

  const renderItem = (item: (typeof ITEMS)[number]) => {
    const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
    return (
      <Link
        key={item.to}
        to={item.to}
        className={`flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors ${
          active ? 'font-bold text-primary' : 'text-on-surface-variant'
        }`}
      >
        <Icon name={item.icon} className="text-[24px]" filled={active} />
        <span className="text-[11px] font-semibold">{item.label}</span>
      </Link>
    )
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg border-t border-outline-variant/30 bg-surface-container-lowest/95 pb-safe shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur-2xl">
      <div className="relative flex h-20 items-center justify-between px-3">
        {left.map(renderItem)}
        <div className="relative -top-5 flex flex-1 items-center justify-center">
          <Link
            to="/scanner"
            aria-label="Escanear produto"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-[0_10px_25px_-5px_rgba(16,185,129,0.4),0_8px_10px_-6px_rgba(15,23,42,0.12)] transition-transform active:scale-95"
          >
            <Icon name="barcode_scanner" className="text-[30px]" />
          </Link>
        </div>
        {right.map(renderItem)}
      </div>
    </nav>
  )
}
