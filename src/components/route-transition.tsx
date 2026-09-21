import { useEffect, useState, type ReactNode } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { Icon } from './Icon'

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <div key={pathname} className="animate-route-enter flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  )
}

export function RouteLoadingIndicator() {
  const isPending = useRouterState({ select: (state) => state.status === 'pending' })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isPending) {
      setVisible(false)
      return
    }
    const timeout = setTimeout(() => setVisible(true), 120)
    return () => clearTimeout(timeout)
  }, [isPending])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center pt-safe transition-all duration-200 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
    >
      <div className="mt-3 flex items-center gap-2 rounded-full bg-inverse-surface/85 px-3 py-1.5 text-inverse-on-surface shadow-[0_8px_24px_rgba(15,23,42,0.25)] backdrop-blur-md">
        <Icon name="progress_activity" className="animate-spin text-[16px] text-primary-fixed" />
        <span className="text-[11px] font-semibold">Carregando…</span>
      </div>
    </div>
  )
}
