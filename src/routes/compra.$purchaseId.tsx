import { createFileRoute, Link } from '@tanstack/react-router'
import { Icon } from '../components/Icon'
import { Badge, EmptyState, ProgressBar } from '../components/ui'
import { formatBRL, formatPercent, formatQuantity } from '../domain/money'
import { fetchPurchaseSummary } from '../server/functions/history'

const COLOR_CLASS: Record<string, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary-container',
  tertiary: 'bg-tertiary-container',
  outline: 'bg-outline-variant',
}

export const Route = createFileRoute('/compra/$purchaseId')({
  loader: ({ params }) => fetchPurchaseSummary({ data: { purchaseId: params.purchaseId } }),
  component: PurchaseSummaryPage,
})

function PurchaseSummaryPage() {
  const summary = Route.useLoaderData()

  if (!summary) {
    return (
      <div className="flex min-h-screen flex-col gap-4 px-4 pt-6">
        <EmptyState
          icon="receipt_long"
          title="Compra não encontrada"
          description="Não localizamos este recibo no seu histórico."
          action={
            <Link
              to="/historico"
              className="rounded-full bg-primary-container px-4 py-2 text-xs font-bold text-on-primary"
            >
              Ver histórico
            </Link>
          }
        />
      </div>
    )
  }

  const { purchase, items, distribution, budget } = summary
  const saved = budget.limitCents - purchase.totalCents

  return (
    <div className="flex min-h-screen flex-col gap-4 px-4 pb-12 pt-safe">
      <div className="flex items-center justify-between pt-4">
        <Link
          to="/historico"
          aria-label="Voltar"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container text-on-surface active:scale-95"
        >
          <Icon name="arrow_back" className="text-[24px]" />
        </Link>
        <span className="text-xs font-semibold text-on-surface-variant">
          {new Date(purchase.purchasedAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-secondary-container/15 blur-xl" />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Badge tone="primary">
              <Icon name="check_circle" className="text-[16px]" filled />
              Compra finalizada
            </Badge>
            <span className="text-[11px] text-on-surface-variant">{purchase.storeName}</span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Total pago no caixa
            </span>
            <div className="flex items-baseline gap-2">
              <span className="tnum text-3xl font-extrabold tracking-tight text-on-surface">
                {formatBRL(purchase.totalCents)}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {saved >= 0 ? `-${formatPercent((saved / budget.limitCents) * 100)} vs meta` : 'acima da meta'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-surface-container-low p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary">
              <Icon name="savings" className="text-[22px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-on-surface">
                  Meta {formatBRL(budget.limitCents)}
                </span>
                <span className="text-[11px] font-bold text-primary">
                  {saved >= 0 ? `${formatBRL(saved)} abaixo` : `${formatBRL(-saved)} acima`}
                </span>
              </div>
              <div className="mt-1.5">
                <ProgressBar
                  percent={budget.percent}
                  tone={budget.isOver ? 'error' : 'primary'}
                />
              </div>
              <p className="mt-2 text-[11px] text-on-surface-variant">
                Você poupou{' '}
                <strong className="font-bold text-primary">{formatBRL(purchase.savingsCents)}</strong> em
                promoções ativadas com o leitor.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-lg bg-surface-container p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-sm">
                <Icon name="shopping_bag" className="text-[18px]" />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase text-on-surface-variant">Itens</span>
                <span className="text-sm font-bold text-on-surface">{items.length} produtos</span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-surface-container p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-secondary-container shadow-sm">
                <Icon name="local_offer" className="text-[18px]" />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase text-on-surface-variant">Descontos</span>
                <span className="tnum text-sm font-bold text-primary">
                  {formatBRL(purchase.savingsCents)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-5 w-2 rounded-full bg-primary" />
            <h2 className="text-base font-bold text-on-surface">Distribuição de gastos</h2>
          </div>
          <span className="text-xs text-on-surface-variant">{distribution.length} categorias</span>
        </div>

        <div className="mt-3 flex h-3.5 w-full overflow-hidden rounded-full bg-surface-container shadow-inner">
          {distribution.map((slice) => (
            <div
              key={slice.categoryId}
              className={COLOR_CLASS[slice.color] ?? 'bg-primary'}
              style={{ width: `${slice.percent}%` }}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {distribution.map((slice) => (
            <div
              key={slice.categoryId}
              className="flex items-center justify-between rounded-lg bg-surface-container-low p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name={slice.icon} className="text-[20px]" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-bold text-on-surface">{slice.name}</span>
                  <span className="text-[11px] text-on-surface-variant">{slice.count} itens</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="tnum block text-sm font-bold text-on-surface">
                  {formatBRL(slice.totalCents)}
                </span>
                <span className="text-[11px] font-bold text-primary">{formatPercent(slice.percent)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-on-surface">Recibo</h2>
        <div className="flex flex-col divide-y divide-outline-variant/30">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-on-surface">{item.name}</span>
                <span className="tnum text-[11px] text-on-surface-variant">
                  {formatQuantity(item.quantity, 'un')} × {formatBRL(item.unitPriceCents)}
                  {item.wasPromo && <span className="ml-1 font-bold text-secondary">· oferta</span>}
                </span>
              </div>
              <span className="tnum shrink-0 text-sm font-bold text-on-surface">
                {formatBRL(item.totalCents)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-outline-variant/40 pt-3">
          <span className="text-sm font-bold text-on-surface">Total</span>
          <span className="tnum text-lg font-extrabold text-primary">
            {formatBRL(purchase.totalCents)}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-surface-container-high text-sm font-bold text-on-surface"
        >
          <Icon name="share" className="text-[20px] text-primary" />
          Exportar recibo
        </button>
        <Link
          to="/"
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-on-primary"
        >
          <Icon name="add_shopping_cart" className="text-[20px]" />
          Nova compra
        </Link>
      </div>
    </div>
  )
}
