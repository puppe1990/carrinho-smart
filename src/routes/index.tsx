import { useMemo, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Icon } from '../components/Icon'
import {
  Badge,
  EmptyState,
  ProgressBar,
  QuantityStepper,
  ScreenHeader,
  Sheet,
} from '../components/ui'
import { formatBRL, formatPercent, formatQuantity } from '../domain/money'
import { fetchCartOverview } from '../server/functions/cart'
import {
  changeBudget,
  changeCartItemQuantity,
  deleteCartItem,
  emptyCart,
  finishCart,
} from '../server/functions/cart'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { store?: string } => ({
    store: typeof search.store === 'string' ? search.store : undefined,
  }),
  loaderDeps: ({ search }) => ({ store: search.store }),
  loader: ({ deps }) => fetchCartOverview({ data: { storeId: deps.store } }),
  component: CartPage,
})

function CartPage() {
  const data = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sheet, setSheet] = useState<'store' | 'budget' | null>(null)
  const [budgetDraft, setBudgetDraft] = useState(String(data.budget.limitCents / 100))
  const [busyLine, setBusyLine] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)

  const { summary, budget, tip } = data

  const countsByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const line of data.lines) {
      counts.set(line.categoryId, (counts.get(line.categoryId) ?? 0) + 1)
    }
    return counts
  }, [data.lines])

  const visibleLines = useMemo(() => {
    const term = query.trim().toLowerCase()
    return data.lines.filter((line) => {
      const matchesCategory = category === 'all' || line.categoryId === category
      const matchesQuery = !term || line.name.toLowerCase().includes(term)
      return matchesCategory && matchesQuery
    })
  }, [data.lines, category, query])

  async function mutate(action: () => Promise<unknown>) {
    await action()
    await router.invalidate()
  }

  async function handleCheckout() {
    setCheckingOut(true)
    try {
      const purchase = await finishCart({ data: { cartId: data.cart.id } })
      await router.invalidate()
      navigate({ to: '/compra/$purchaseId', params: { purchaseId: purchase.id } })
    } finally {
      setCheckingOut(false)
    }
  }

  const gaugeTone =
    budget.level === 'over' ? 'error' : budget.level === 'warning' ? 'secondary' : 'primary'

  return (
    <div className="flex min-h-screen flex-col pb-64">
      <ScreenHeader storeName={data.store?.name} onChangeStore={() => setSheet('store')} />

      <main className="flex flex-1 flex-col gap-4 px-4 pt-4">
        <section className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary-container/10 blur-2xl" />
          <div className="relative z-10 mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-ping rounded-full bg-primary-container" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Monitor em tempo real
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setBudgetDraft(String(budget.limitCents / 100))
                setSheet('budget')
              }}
              className="flex items-center gap-1 rounded-full bg-surface-container px-2 py-1 text-[11px] font-semibold text-on-surface"
            >
              <Icon name="tune" className="text-[14px]" />
              Ajustar limite
            </button>
          </div>

          <div className="relative z-10 flex items-baseline justify-between gap-2">
            <div>
              <span className="block text-xs text-on-surface-variant">Total no carrinho</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-primary">R$</span>
                <span className="tnum text-3xl font-extrabold tracking-tight text-on-surface">
                  {formatBRL(summary.totalCents).replace('R$ ', '')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-[11px] text-on-surface-variant">Meta estipulada</span>
              <span className="tnum text-sm font-semibold text-on-surface">
                {formatBRL(budget.limitCents)}
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-3 space-y-1.5">
            <ProgressBar percent={budget.percent} tone={gaugeTone} className="h-3" />
            <div className="flex items-center justify-between text-[11px]">
              <span
                className={`flex items-center gap-1 font-semibold ${
                  budget.level === 'over' ? 'text-error' : 'text-primary'
                }`}
              >
                <Icon name={budget.isOver ? 'error' : 'check_circle'} className="text-[14px]" />
                {formatPercent(budget.percent)} do teto planejado
              </span>
              <span className="text-on-surface-variant">
                Restam{' '}
                <strong className="font-bold text-on-surface">
                  {formatBRL(budget.remainingCents)}
                </strong>
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-3 flex items-center justify-between rounded-lg bg-surface-container-low p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container/20 text-secondary">
                <Icon name="savings" className="text-[18px]" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">
                  Economia de {formatBRL(summary.savingsCents)} hoje
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  {data.lines.filter((line) => line.promo).length} itens com desconto aplicado
                </span>
              </div>
            </div>
            <Icon name="verified" className="text-[20px] text-primary" />
          </div>
        </section>

        <section className="space-y-2">
          <div className="relative w-full">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar item no carrinho (ex: café, leite)..."
              className="h-12 w-full rounded-xl bg-surface-container-lowest pl-10 pr-10 text-sm text-on-surface shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05)] outline-none placeholder:text-outline focus:ring-2 focus:ring-primary/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            )}
          </div>

          <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
                category === 'all'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-lowest text-on-surface shadow-sm'
              }`}
            >
              Todos
              <span className="rounded-full bg-primary-container px-1.5 text-[10px] font-bold text-on-primary-container">
                {data.lines.length}
              </span>
            </button>
            {data.categories.map((cat) => {
              const count = countsByCategory.get(cat.id) ?? 0
              if (count === 0) return null
              const active = category === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
                    active
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-lowest text-on-surface shadow-sm'
                  }`}
                >
                  <Icon name={cat.icon} className="text-[16px]" />
                  {cat.name}
                  <span className="text-[10px] text-on-surface-variant">{count}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
              Itens escaneados
              <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                {summary.kindCount} tipos
              </span>
            </h2>
            <button
              type="button"
              disabled={data.lines.length === 0}
              onClick={() => mutate(() => emptyCart({ data: { cartId: data.cart.id } }))}
              className="text-[11px] font-bold text-primary hover:underline disabled:opacity-40"
            >
              Limpar tudo
            </button>
          </div>

          {visibleLines.length === 0 ? (
            data.lines.length === 0 ? (
              <EmptyState
                icon="shopping_cart"
                title="Seu carrinho está vazio"
                description="Bipe um produto com a câmera ou monte sua lista de compras para começar."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link
                      to="/scanner"
                      className="flex items-center gap-1 rounded-full bg-primary-container px-4 py-2 text-xs font-bold text-on-primary"
                    >
                      <Icon name="barcode_scanner" className="text-[16px]" />
                      Escanear produto
                    </Link>
                    <Link
                      to="/lista"
                      className="flex items-center gap-1 rounded-full bg-surface-container px-4 py-2 text-xs font-bold text-on-surface"
                    >
                      <Icon name="checklist" className="text-[16px]" />
                      Criar minha lista
                    </Link>
                  </div>
                }
              />
            ) : (
              <EmptyState
                icon="search_off"
                title="Nenhum item encontrado"
                description="Ajuste a busca ou o filtro de categoria para ver os itens do carrinho."
              />
            )
          ) : (
            visibleLines.map((line) => (
              <article
                key={line.id}
                className="rounded-xl bg-surface-container-lowest p-3 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary">
                    <Icon
                      name={
                        data.categories.find((cat) => cat.id === line.categoryId)?.icon ?? 'grocery'
                      }
                      className="text-[26px]"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="truncate text-sm font-bold text-on-surface">{line.name}</h3>
                      <button
                        type="button"
                        aria-label={`Remover ${line.name}`}
                        disabled={busyLine === line.id}
                        onClick={async () => {
                          setBusyLine(line.id)
                          await mutate(() => deleteCartItem({ data: { lineId: line.id } }))
                          setBusyLine(null)
                        }}
                        className="-mr-1 p-1 text-outline transition-colors hover:text-error"
                      >
                        <Icon name="delete_outline" className="text-[18px]" />
                      </button>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
                      {line.promo && <Badge tone="secondary">Oferta</Badge>}
                      <span className="tnum font-semibold text-primary">
                        {formatBRL(line.unitPriceCents)} / {line.unit}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <QuantityStepper
                        value={line.quantity}
                        unit={line.unit}
                        busy={busyLine === line.id}
                        onDecrement={async () => {
                          if (line.quantity <= 1) return
                          setBusyLine(line.id)
                          await mutate(() =>
                            changeCartItemQuantity({
                              data: { lineId: line.id, quantity: line.quantity - 1 },
                            }),
                          )
                          setBusyLine(null)
                        }}
                        onIncrement={async () => {
                          setBusyLine(line.id)
                          await mutate(() =>
                            changeCartItemQuantity({
                              data: { lineId: line.id, quantity: line.quantity + 1 },
                            }),
                          )
                          setBusyLine(null)
                        }}
                      />
                      <div className="text-right">
                        <div className="text-[10px] text-on-surface-variant">
                          {formatQuantity(line.quantity, line.unit)}
                        </div>
                        <span className="tnum text-base font-bold text-on-surface">
                          {formatBRL(Math.round(line.unitPriceCents * line.quantity))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        {tip.extraCount > 0 && (
          <section className="flex items-start gap-3 rounded-xl bg-secondary-fixed/40 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
              <Icon name="lightbulb" className="text-[18px]" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-on-secondary-container">
                Item extra detectado
              </span>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">
                Você bipou{' '}
                <strong className="text-on-surface">{tip.extraCount} item(ns) fora do plano</strong>
                , impacto de{' '}
                <strong className="text-on-surface">{formatBRL(tip.extraImpactCents)}</strong> no
                orçamento final.
              </p>
            </div>
          </section>
        )}

        {tip.nextPendingName && (
          <section className="flex items-center gap-3 rounded-xl bg-surface-container-high p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
              <Icon name="smart_toy" className="text-[20px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-on-surface">Dica do CarrinhoSmart</p>
              <p className="text-[11px] text-on-surface-variant">
                Próximo item da sua lista: {tip.nextPendingName}.
              </p>
            </div>
            <Link to="/lista" className="text-primary">
              <Icon name="chevron_right" className="text-[20px]" />
            </Link>
          </section>
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto max-w-lg px-4">
        <div className="pointer-events-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest/95 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="shopping_bag" className="text-[22px] text-primary" />
              <div>
                <span className="block text-[11px] text-on-surface-variant">Subtotal parcial</span>
                <span className="text-[11px] font-bold text-primary">
                  {summary.unitCount} unidades no cesto
                </span>
              </div>
            </div>
            <span className="tnum text-lg font-extrabold text-on-surface">
              {formatBRL(summary.totalCents)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/scanner"
              className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-surface-container text-sm font-bold text-on-surface"
            >
              <Icon name="barcode_reader" className="text-[20px] text-primary" />
              Ler código
            </Link>
            <button
              type="button"
              disabled={checkingOut || summary.kindCount === 0}
              onClick={handleCheckout}
              className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-primary-container text-sm font-bold text-on-primary-container shadow-[0_4px_16px_rgba(16,185,129,0.3)] disabled:opacity-50"
            >
              {checkingOut ? 'Processando...' : 'Ir ao caixa'}
              <Icon name="arrow_forward" className="text-[20px]" />
            </button>
          </div>
        </div>
      </div>

      <Sheet open={sheet === 'store'} onClose={() => setSheet(null)} title="Trocar de loja">
        <div className="flex flex-col gap-2">
          {data.stores.map((store) => (
            <button
              key={store.id}
              type="button"
              onClick={() => {
                setSheet(null)
                navigate({ to: '/', search: { store: store.id } })
              }}
              className={`flex items-center justify-between rounded-xl border p-3 text-left ${
                store.id === data.store?.id
                  ? 'border-primary bg-primary-fixed/20'
                  : 'border-outline-variant bg-surface'
              }`}
            >
              <div>
                <span className="block text-sm font-semibold text-on-surface">{store.name}</span>
                <span className="text-[11px] text-on-surface-variant">{store.city}</span>
              </div>
              {store.id === data.store?.id && (
                <Icon name="check_circle" className="text-primary" filled />
              )}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'budget'} onClose={() => setSheet(null)} title="Ajustar meta de gasto">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Teto do orçamento (R$)
        </label>
        <input
          type="number"
          step="0.01"
          value={budgetDraft}
          onChange={(event) => setBudgetDraft(event.target.value)}
          className="mt-2 w-full rounded-xl bg-surface-container-low p-3 text-2xl font-extrabold text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={async () => {
            const cents = Math.round(Number(budgetDraft.replace(',', '.')) * 100)
            if (Number.isFinite(cents) && cents > 0) {
              await mutate(() =>
                changeBudget({ data: { cartId: data.cart.id, budgetCents: cents } }),
              )
            }
            setSheet(null)
          }}
          className="mt-4 h-12 w-full rounded-full bg-primary-container text-sm font-bold text-on-primary"
        >
          Salvar meta
        </button>
      </Sheet>
    </div>
  )
}
