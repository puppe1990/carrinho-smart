import { createFileRoute, Link } from '@tanstack/react-router'
import { Icon } from '../components/Icon'
import { Badge, EmptyState, ProgressBar, ScreenHeader } from '../components/ui'
import { formatBRL, formatPercent } from '../domain/money'
import { fetchCartOverview } from '../server/functions/cart'
import { fetchMonthSummary, fetchMonths } from '../server/functions/history'

type MonthRef = { year: number; month: number; key: string; label: string }

const COLOR_CLASS: Record<string, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary-container',
  tertiary: 'bg-tertiary-container',
  outline: 'bg-outline-variant',
}

export const Route = createFileRoute('/resumo')({
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
    const summary = await fetchMonthSummary({
      data: { year: target?.year, month: target?.month },
    })
    return { months: list, summary, target: target ?? null, storeName: cart.store?.name }
  },
  component: SummaryPage,
})

function SummaryPage() {
  const { months, summary, target, storeName } = Route.useLoaderData()
  const navigate = Route.useNavigate()

  const index = target ? months.findIndex((month) => month.key === target.key) : -1
  const older = index >= 0 ? months[index + 1] : undefined
  const newer = index > 0 ? months[index - 1] : undefined

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <ScreenHeader storeName={storeName} />

      <main className="flex flex-1 flex-col gap-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Resumo do mês</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Mês anterior"
              disabled={!older}
              onClick={() =>
                older && navigate({ search: { year: older.year, month: older.month } })
              }
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant active:scale-90 disabled:opacity-30"
            >
              <Icon name="chevron_left" className="text-[20px]" />
            </button>
            <span className="px-1 text-xs font-bold text-on-surface">{target?.label ?? '--'}</span>
            <button
              type="button"
              aria-label="Próximo mês"
              disabled={!newer}
              onClick={() =>
                newer && navigate({ search: { year: newer.year, month: newer.month } })
              }
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant active:scale-90 disabled:opacity-30"
            >
              <Icon name="chevron_right" className="text-[20px]" />
            </button>
          </div>
        </div>

        {!summary ? (
          <EmptyState
            icon="insights"
            title="Sem dados para resumir"
            description="Finalize uma compra para gerar o resumo do mês."
            action={
              <Link
                to="/"
                className="rounded-full bg-primary-container px-4 py-2 text-xs font-bold text-on-primary"
              >
                Ir para o carrinho
              </Link>
            }
          />
        ) : (
          <>
            <section className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
              <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <Badge tone="primary">
                    <Icon name="check_circle" className="text-[16px]" filled />
                    {summary.overview.count} compras registradas
                  </Badge>
                  <span className="text-xs text-on-surface-variant">{summary.label}</span>
                </div>

                <div>
                  <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                    Total gasto no mês
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="tnum text-3xl font-extrabold tracking-tight text-on-surface">
                      {formatBRL(summary.overview.totalCents)}
                    </span>
                    <Badge tone={summary.overview.withinBudget ? 'primary' : 'error'}>
                      {summary.overview.withinBudget ? 'Dentro' : 'Acima'} da meta
                    </Badge>
                  </div>
                </div>

                <div className="rounded-lg bg-surface-container-low p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-on-surface">
                      Meta {formatBRL(summary.overview.budgetCents)}
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {summary.overview.withinBudget
                        ? `${formatBRL(summary.overview.remainingCents)} abaixo`
                        : `${formatPercent(summary.overview.usedPercent)} usado`}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      percent={summary.overview.usedPercent}
                      tone={summary.overview.withinBudget ? 'primary' : 'error'}
                    />
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Você economizou{' '}
                    <strong className="font-bold text-primary">
                      {formatBRL(summary.overview.savingsCents)}
                    </strong>{' '}
                    em promoções ativadas com o leitor.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 rounded-lg bg-surface-container p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-sm">
                      <Icon name="shopping_bag" className="text-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase text-on-surface-variant">
                        Itens
                      </span>
                      <span className="text-sm font-bold text-on-surface">
                        {summary.items.length} produtos
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-surface-container p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-secondary-container shadow-sm">
                      <Icon name="local_offer" className="text-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase text-on-surface-variant">
                        Descontos
                      </span>
                      <span className="tnum text-sm font-bold text-primary">
                        {formatBRL(summary.overview.savingsCents)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="flex h-12 items-center justify-center gap-2 rounded-full bg-surface-container-high text-sm font-bold text-on-surface"
                  >
                    <Icon name="share" className="text-[20px] text-primary" />
                    Exportar
                  </button>
                  <Link
                    to="/historico"
                    className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-on-primary"
                  >
                    <Icon name="receipt_long" className="text-[20px]" />
                    Ver histórico
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-2 rounded-full bg-primary" />
                  <h2 className="text-base font-bold text-on-surface">Distribuição de gastos</h2>
                </div>
                <span className="text-xs text-on-surface-variant">
                  {summary.distribution.length} categorias
                </span>
              </div>

              <div className="mt-3 flex h-3.5 w-full overflow-hidden rounded-full bg-surface-container shadow-inner">
                {summary.distribution.map((slice) => (
                  <div
                    key={slice.categoryId}
                    className={COLOR_CLASS[slice.color] ?? 'bg-primary'}
                    style={{ width: `${slice.percent}%` }}
                    title={`${slice.name}: ${slice.percent}%`}
                  />
                ))}
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {summary.distribution.map((slice) => (
                  <div
                    key={slice.categoryId}
                    className="flex items-center justify-between rounded-lg bg-surface-container-low p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon name={slice.icon} className="text-[20px]" />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-bold text-on-surface">
                          {slice.name}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          {slice.count} itens
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="tnum block text-sm font-bold text-on-surface">
                        {formatBRL(slice.totalCents)}
                      </span>
                      <span className="text-[11px] font-bold text-primary">
                        {formatPercent(slice.percent)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
              <h2 className="mb-3 text-base font-bold text-on-surface">Compras do mês</h2>
              <div className="flex flex-col gap-2">
                {summary.purchases.map((purchase) => (
                  <Link
                    key={purchase.id}
                    to="/compra/$purchaseId"
                    params={{ purchaseId: purchase.id }}
                    className="flex items-center justify-between rounded-lg bg-surface-container-low p-3"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-on-surface">
                        {purchase.storeName}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {new Date(purchase.purchasedAt).toLocaleDateString('pt-BR')} ·{' '}
                        {purchase.itemCount} itens
                      </span>
                    </div>
                    <span className="tnum shrink-0 text-sm font-bold text-on-surface">
                      {formatBRL(purchase.totalCents)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
