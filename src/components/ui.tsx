import type { ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Icon } from './Icon'
import { Logo } from './Logo'

function clamp(value: number) {
  return Math.max(0, Math.min(100, value))
}

export function ProgressBar({
  percent,
  tone = 'primary',
  className = 'h-2',
}: {
  percent: number
  tone?: 'primary' | 'secondary' | 'error'
  className?: string
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-primary-container'
      : tone === 'secondary'
        ? 'bg-secondary-container'
        : 'bg-error'
  return (
    <div className={`w-full overflow-hidden rounded-full bg-surface-container-high ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${toneClass}`}
        style={{ width: `${clamp(percent)}%` }}
      />
    </div>
  )
}

export function SegmentedBudgetBar({
  basePercent,
  deltaPercent,
  over,
  className = 'h-3',
}: {
  basePercent: number
  deltaPercent: number
  over: boolean
  className?: string
}) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-surface-container ${className}`}>
      <div
        className="h-full bg-primary-container transition-all duration-500"
        style={{ width: `${clamp(basePercent)}%` }}
      />
      <div
        className={`h-full transition-all duration-500 ${over ? 'bg-error' : 'bg-secondary-container'}`}
        style={{ width: `${clamp(deltaPercent)}%` }}
      />
    </div>
  )
}

export function ProgressRing({ percent, label }: { percent: number; label: ReactNode }) {
  const circumference = 125.6
  const offset = circumference * (1 - clamp(percent) / 100)
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 48 48">
        <circle
          className="text-surface-container-highest"
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
        <circle
          className="text-primary-container transition-all duration-700"
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{label}</div>
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'primary' | 'secondary' | 'error' | 'tertiary'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-container text-on-surface-variant',
    primary: 'bg-primary-fixed/40 text-primary',
    secondary: 'bg-secondary-fixed/50 text-on-secondary-container',
    error: 'bg-error-container text-on-error-container',
    tertiary: 'bg-tertiary-fixed/40 text-tertiary',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function QuantityStepper({
  value,
  unit,
  onDecrement,
  onIncrement,
  busy = false,
}: {
  value: number
  unit?: string
  onDecrement: () => void
  onIncrement: () => void
  busy?: boolean
}) {
  const display = unit === 'kg' || unit === 'L' ? value.toLocaleString('pt-BR') : String(value)
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-surface-container-low p-1 shadow-inner">
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={busy}
        onClick={onDecrement}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface shadow-xs transition-transform active:scale-90 disabled:opacity-50"
      >
        <Icon name="remove" className="text-[16px]" />
      </button>
      <span className="tnum min-w-[28px] px-1 text-center text-sm font-bold text-on-surface">
        {display}
      </span>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={busy}
        onClick={onIncrement}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary shadow-xs transition-transform active:scale-90 disabled:opacity-50"
      >
        <Icon name="add" className="text-[16px]" />
      </button>
    </div>
  )
}

export function ScreenHeader({
  storeName,
  onChangeStore,
}: {
  storeName?: string
  onChangeStore?: () => void
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/20 bg-surface/85 pt-safe backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Logo compact />
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              <Icon name="storefront" className="text-[13px] text-primary" />
              <span>Loja atual</span>
            </div>
            <button
              type="button"
              onClick={onChangeStore}
              className="flex min-w-0 items-center gap-0.5 text-left"
            >
              <span className="truncate text-sm font-semibold text-on-surface">
                {storeName ?? 'Selecionar loja'}
              </span>
              <Icon name="expand_more" className="shrink-0 text-[18px] text-on-surface-variant" />
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Notificações"
          className="relative flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container active:scale-95"
        >
          <Icon name="notifications" className="text-[22px]" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-secondary-container ring-2 ring-surface" />
        </button>
      </div>
    </header>
  )
}

export function SubHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/20 bg-surface/90 pt-safe backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => router.history.back()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container active:scale-95"
        >
          <Icon name="arrow_back" className="text-[24px]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-on-surface">{title}</h1>
          {subtitle && <p className="truncate text-xs text-on-surface-variant">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal>
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 cursor-default bg-inverse-surface/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg animate-fade-in rounded-t-3xl bg-surface-container-lowest p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-surface-container-highest" />
        <h2 className="mb-3 text-base font-bold text-on-surface">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-container-lowest p-8 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-primary">
        <Icon name={icon} className="text-[28px]" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-on-surface">{title}</h3>
        <p className="mt-1 text-xs text-on-surface-variant">{description}</p>
      </div>
      {action}
    </div>
  )
}
