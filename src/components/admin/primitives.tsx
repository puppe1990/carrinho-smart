import { useEffect, useId, type ReactNode } from 'react'
import { Icon } from '../Icon'

export const adminInputClass =
  'h-10 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none placeholder:text-outline/70 focus:border-primary focus:ring-2 focus:ring-primary/30'

export const primaryButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-on-primary transition-transform active:scale-[0.98] disabled:opacity-60'

export const ghostButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-outline-variant/50 px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60'

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">{title}</h1>
        {description && <p className="mt-1 text-sm text-on-surface-variant">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name={icon} className="text-[18px] text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="tnum mt-2 text-2xl font-extrabold text-on-surface">{value}</p>
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Icon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline"
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? 'Buscar...'}
        aria-label={placeholder ?? 'Buscar'}
        className={`${adminInputClass} pl-9`}
      />
    </div>
  )
}

export function AdminField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-on-surface-variant">{hint}</span>}
    </label>
  )
}

export interface AdminColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

export function AdminTable({
  columns,
  children,
  empty,
}: {
  columns: AdminColumn[]
  children: ReactNode
  empty?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
      {!empty && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant ${
                      column.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
      {empty && (
        <div className="p-8 text-center text-sm text-on-surface-variant">Nenhum registro.</div>
      )}
    </div>
  )
}

export function AdminRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low/60">
      {children}
    </tr>
  )
}

export function AdminCell({
  children,
  align = 'left',
}: {
  children: ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <td className={`px-4 py-3 text-on-surface ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </td>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <nav
      aria-label="Paginação"
      className="mt-4 flex items-center justify-between text-sm text-on-surface-variant"
    >
      <span>
        {total} registro(s) · página {page} de {pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={ghostButtonClass}
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className={ghostButtonClass}
        >
          Próxima
        </button>
      </div>
    </nav>
  )
}

export function AdminModal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const titleId = useId()

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fechar"
        className="absolute inset-0 cursor-default bg-inverse-surface/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 id={titleId} className="text-lg font-bold text-on-surface">
          {title}
        </h2>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Excluir',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AdminModal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={ghostButtonClass} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-error px-4 text-sm font-bold text-on-error transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-on-surface-variant">{message}</p>
    </AdminModal>
  )
}
