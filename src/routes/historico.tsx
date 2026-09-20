import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Icon } from '../components/Icon'
import { Badge, EmptyState, ProgressBar, ScreenHeader } from '../components/ui'
import { formatBRL, formatPercent } from '../domain/money'
import { fetchHistory, fetchMonths } from '../server/functions/history'
import { fetchCartOverview } from '../server/functions/cart'

type MonthRef = { year: number; month: number; key: string; label: string }

export const Route = createFileRoute('/historico')({
  validateSearch: (search: Record<string, unknown>): { year?: number; month?: number } => ({
    year: typeof search.year === 'number' ? search.year : undefined,
    month: typeof search.month === 'number' ? search.month : undefined,
  }),
  loaderDeps: ({ search }) => ({ year: search.year, month: search.month }),
  loader: async ({ deps }) => {
    const [months, cart] = await Promise.all([fetchMonths(), fetchCartOverview({ data: {} })])
    const list = months as MonthRef[]
    const target =
      list.find((month) => month.year === deps.year && month.month === deps.month) ?? list[0]
    const history = target
      ? await fetchHistory({ data: { year: target.year, month: target.month } })
      : null
    return { months: list, history, target: target ?? null, storeName: cart.store?.name }
  },
  component: HistoryPage,
})

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function HistoryPage() {
  const { months, history, target, storeName } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const [query, setQuery] = useState('')
  const [storeFilter, setStoreFilter] = useState('all')

  const index = target ? months.findIndex((month) => month.key === target.key) : -1
  const older = index >= 0 ? months[index + 1] : undefined
  const newer = index > 0 ? months[index - 1] : undefined

  const purchases = useMemo(() => {
    if (!history) return []
    const term = query.trim().toLowerCase()
    return history.purchases.filter((purchase) => {
      const matchesStore = storeFilter === 'all' || purchase.storeId === storeFilter
      const matchesQuery =
        !term ||
        purchase.storeName.toLowerCase().includes(term) ||
        purchase.purchasedAt.toLowerCase().includes(term)
      return matchesStore && matchesQuery
    })
  }, [history, query, storeFilter])

  const overview = history?.overview

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <ScreenHeader storeName={storeName} />

      <main className="flex flex-1 flex-col gap-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Controle financeiro
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
              Histórico de compras
            </h1>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-full bg-surface-container-lowest p-1.5 shadow-sm">
          <button
            type="button"
            aria-label="Mês anterior"
            disabled={!older}
            onClick={() => older && navigate({ search: { year: older.year, month: older.month } })}
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant active:scale-90 disabled:opacity-30"
          >
            <Icon name="chevron_left" className="text-[20px]" />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1">
            <Icon name="calendar_month" className="text-[18px] text-primary" />
            <span className="text-sm font-bold text-on-surface">
              {target?.label ?? 'Sem compras'}
            </span>
          </div>
          <button
            type="button"
            aria-label="Próximo mês"
            disabled={!newer}
            onClick={() => newer && navigate({ search: { year: newer.year, month: newer.month } })}
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant active:scale-90 disabled:opacity-30"
          >
            <Icon name="chevron_right" className="text-[20px]" />
          </button>
        </div>

        {months.length === 0 && (
          <section className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-fixed/50 text-on-secondary-container">
                <Icon name="info" className="text-[20px]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-on-surface">Nenhuma compra finalizada ainda</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Finalize um carrinho em “Ir ao caixa” para começar a acompanhar seu histórico,
                  economia e orçamento por mês.
                </p>
                <Link
                  to="/"
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1.5 text-[11px] font-bold text-on-primary"
                >
                  <Icon name="shopping_cart_checkout" className="text-[16px]" />
                  Ir para o carrinho
                </Link>
              </div>
            </div>
          </section>
        )}

        {overview && (
          <section className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary-fixed/20 blur-2xl" />
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div>
                <span className="text-xs text-on-surface-variant">Gasto total acumulado</span>
                <div className="tnum text-3xl font-extrabold tracking-tight text-on-surface">
                  {formatBRL(overview.totalCents)}
                </div>
              </div>
              <Badge tone={overview.withinBudget ? 'primary' : 'error'}>
                <Icon
                  name={overview.withinBudget ? 'trending_down' : 'trending_up'}
                  className="text-[14px]"
                />
                {formatPercent(overview.usedPercent)} da meta
              </Badge>
            </div>

            <div className="relative z-10 mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-on-surface-variant">
                  <Icon name="tune" className="text-[15px] text-tertiary" />
                  Meta: {formatBRL(overview.budgetCents)}
                </span>
                <span className="font-bold text-primary">
                  {formatPercent(overview.usedPercent)} utilizado
                </span>
              </div>
              <ProgressBar
                percent={overview.usedPercent}
                tone={overview.withinBudget ? 'primary' : 'error'}
                className="h-2.5"
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>
                  Restante:{' '}
                  <strong className="font-semibold text-on-surface">
                    {formatBRL(overview.remainingCents)}
                  </strong>
                </span>
                <span className="flex items-center gap-0.5 font-semibold text-primary">
                  <Icon name="check_circle" className="text-[12px]" />
                  {overview.withinBudget ? 'Dentro do teto' : 'Acima do teto'}
                </span>
              </div>
            </div>

            <div className="relative z-10 mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface-container-low/60 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tertiary-fixed/40 text-tertiary">
                  <Icon name="savings" className="text-[18px]" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase text-on-surface-variant">
                    Economizado
                  </span>
                  <span className="tnum text-sm font-bold text-tertiary">
                    {formatBRL(overview.savingsCents)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface">
                  <Icon name="local_mall" className="text-[18px]" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase text-on-surface-variant">
                    Frequência
                  </span>
                  <span className="text-sm font-bold text-on-surface">
                    {overview.count} compras
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="flex flex-col gap-2">
          <div className="relative flex items-center">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 text-[20px] text-on-surface-variant"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por mercado, item ou data..."
              className="h-11 w-full rounded-xl bg-surface-container-lowest pl-10 pr-4 text-sm shadow-sm outline-none placeholder:text-outline"
            />
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
            <button
              type="button"
              onClick={() => setStoreFilter('all')}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                storeFilter === 'all'
                  ? 'bg-primary-container text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface-variant shadow-sm'
              }`}
            >
              Todas
            </button>
            {(history?.stores ?? []).map((store) => (
              <button
                key={store.id}
                type="button"
                onClick={() => setStoreFilter(store.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                  storeFilter === store.id
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container-lowest text-on-surface-variant shadow-sm'
                }`}
              >
                {store.name}
              </button>
            ))}
          </div>
        </div>

        <section className="flex flex-col gap-3">
          {purchases.length === 0 && history && (
            <EmptyState
              icon="receipt_long"
              title="Nenhuma compra neste período"
              description={
                months.length === 0
                  ? 'Suas compras finalizadas aparecem aqui, com total, economia e meta.'
                  : 'Nenhuma compra registrada neste mês — tente outro período.'
              }
            />
          )}
          {purchases.map((purchase) => {
            const within = purchase.totalCents <= purchase.budgetCents
            return (
              <Link
                key={purchase.id}
                to="/compra/$purchaseId"
                params={{ purchaseId: purchase.id }}
                className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
                      <Icon name="storefront" className="text-[26px]" />
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-bold text-on-surface">
                        {purchase.storeName}
                      </span>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                        <Icon name="schedule" className="text-[14px]" />
                        <span>{formatDateTime(purchase.purchasedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Badge tone={within ? 'primary' : 'error'}>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${within ? 'bg-primary' : 'bg-error'}`}
                    />
                    {within ? 'Dentro da meta' : 'Acima da meta'}
                  </Badge>
                </div>

                <div className="flex items-end justify-between pt-1">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-xs text-on-surface">
                      <Icon name="qr_code_scanner" className="text-[16px] text-tertiary" />
                      <span>{purchase.itemCount} produtos escaneados</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 rounded-md bg-tertiary-fixed/30 px-2 py-0.5 text-[10px] font-bold text-tertiary">
                        <Icon name="local_offer" className="text-[12px]" />
                        Economia: {formatBRL(purchase.savingsCents)}
                      </span>
                      <span className="text-[10px] text-outline">
                        Meta {formatBRL(purchase.budgetCents)}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block text-[10px] text-on-surface-variant">Valor pago</span>
                    <span className="tnum text-lg font-extrabold text-on-surface">
                      {formatBRL(purchase.totalCents)}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </section>
      </main>
    </div>
  )
}
