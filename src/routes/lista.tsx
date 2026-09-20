import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Icon } from '../components/Icon'
import { ProgressRing, ScreenHeader, Sheet } from '../components/ui'
import { formatBRL, formatPercent, formatQuantity, parseBRL } from '../domain/money'
import { fetchCartOverview } from '../server/functions/cart'
import { fetchShoppingList } from '../server/functions/lists'
import {
  createQuickItem,
  removeListItemFn,
  resetListItemFn,
  scanListItemFn,
} from '../server/functions/lists'

export const Route = createFileRoute('/lista')({
  loader: async () => {
    const [list, cart] = await Promise.all([
      fetchShoppingList(),
      fetchCartOverview({ data: {} }),
    ])
    return { list, cart }
  },
  component: ShoppingListPage,
})

function ShoppingListPage() {
  const { list, cart } = Route.useLoaderData()
  const router = useRouter()
  const [quickName, setQuickName] = useState('')
  const [scanTarget, setScanTarget] = useState<{ id: string; name: string } | null>(null)
  const [scanPrice, setScanPrice] = useState('')
  const [scanQty, setScanQty] = useState('1')
  const [busy, setBusy] = useState(false)

  const { progress } = list
  const pending = list.items.filter((item) => item.status === 'pending')
  const scanned = list.items.filter((item) => item.status === 'scanned')

  async function mutate(action: () => Promise<unknown>) {
    await action()
    await router.invalidate()
  }

  function openScan(item: { id: string; name: string; expectedPriceCents: number }) {
    setScanTarget({ id: item.id, name: item.name })
    setScanPrice((item.expectedPriceCents / 100).toFixed(2))
    setScanQty('1')
  }

  async function confirmScan() {
    if (!scanTarget) return
    setBusy(true)
    try {
      await scanListItemFn({
        data: {
          itemId: scanTarget.id,
          cartId: cart.cart.id,
          unitPriceCents: parseBRL(scanPrice),
          quantity: Number(scanQty) || 1,
        },
      })
      setScanTarget(null)
      await router.invalidate()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col pb-32">
      <ScreenHeader storeName={cart.store?.name} />

      <main className="flex flex-1 flex-col gap-4 px-4 pt-4">
        <section className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Icon name="event_note" className="text-[16px]" />
                <span>{list.list?.shoppingDate ?? 'Hoje'}</span>
              </div>
              <h1 className="truncate text-lg font-bold text-on-surface">
                {list.list?.name ?? 'Lista de compras'}
              </h1>
            </div>
            <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">
              {progress.total} itens
            </span>
          </div>

          <div className="flex items-center gap-4 rounded-lg bg-surface-container-low p-3">
            <ProgressRing
              percent={progress.percentScanned}
              label={
                <span className="text-xs font-bold text-primary">
                  {formatPercent(progress.percentScanned)}
                </span>
              }
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">
                  {progress.scannedCount} de {progress.total} itens no carrinho
                </span>
                <span className="rounded-full bg-primary-fixed/40 px-1.5 text-[10px] font-bold text-primary">
                  {progress.remainingCount} restantes
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className="h-full rounded-full bg-primary-container transition-all duration-500"
                  style={{ width: `${progress.percentScanned}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>
                  Previsto: <strong className="font-semibold text-on-surface">{formatBRL(progress.expectedTotalCents)}</strong>
                </span>
                <span>
                  Atual: <strong className="font-bold text-primary">{formatBRL(progress.scannedTotalCents)}</strong>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center gap-2 rounded-xl bg-surface-container-lowest p-1.5 pl-3 shadow-sm">
          <Icon name="add_task" className="text-[22px] text-outline" />
          <input
            value={quickName}
            onChange={(event) => setQuickName(event.target.value)}
            placeholder="Adicionar item à lista..."
            onKeyDown={async (event) => {
              if (event.key === 'Enter' && quickName.trim() && list.list) {
                await mutate(() => createQuickItem({ data: { listId: list.list!.id, name: quickName } }))
                setQuickName('')
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-outline/70"
          />
          <button
            type="button"
            aria-label="Comando por voz"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-tertiary"
          >
            <Icon name="mic" className="text-[20px]" />
          </button>
          <button
            type="button"
            aria-label="Adicionar item"
            disabled={!quickName.trim() || !list.list}
            onClick={async () => {
              if (!list.list) return
              await mutate(() => createQuickItem({ data: { listId: list.list!.id, name: quickName } }))
              setQuickName('')
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-on-primary shadow-sm active:scale-90 disabled:opacity-50"
          >
            <Icon name="add" className="text-[20px]" />
          </button>
        </section>

        {cart.tip.extraCount > 0 && (
          <section className="flex items-start gap-3 rounded-xl bg-secondary-fixed/40 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
              <Icon name="lightbulb" className="text-[18px]" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-on-secondary-container">
                Item extra detectado
              </span>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">
                {cart.tip.extraCount} item(ns) fora do plano, impacto de{' '}
                <strong className="text-on-surface">{formatBRL(cart.tip.extraImpactCents)}</strong> no
                orçamento.
              </p>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-secondary-container" />
              <h2 className="text-sm font-bold text-on-surface">Pendentes na prateleira</h2>
            </div>
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">
              {pending.length} itens
            </span>
          </div>

          {pending.length === 0 && (
            <p className="rounded-xl bg-surface-container-lowest p-4 text-center text-xs text-on-surface-variant shadow-sm">
              Todos os itens já estão no carrinho.
            </p>
          )}

          {pending.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-lowest p-3 shadow-sm"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                  type="button"
                  aria-label={`Marcar ${item.name} como comprado`}
                  disabled={busy}
                  onClick={() => openScan(item)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-container"
                >
                  <Icon name="check" className="text-[18px] text-transparent" />
                </button>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-on-surface">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                    <span>{item.aisle ?? 'Lista rápida'}</span>
                    <span>•</span>
                    <span className="font-medium text-on-surface">
                      Est. {formatBRL(item.expectedPriceCents)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Bipar ${item.name}`}
                onClick={() => openScan(item)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-primary-fixed/40 px-3 py-2 text-[11px] font-bold text-primary active:scale-95"
              >
                <Icon name="barcode_scanner" className="text-[18px]" />
                Bipar
              </button>
            </div>
          ))}
        </section>

        <section className="mt-1 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary-container" />
              <h2 className="text-sm font-bold text-on-surface">Já no carrinho</h2>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-primary-fixed/30 px-2 py-0.5 text-[11px] font-bold text-primary">
              <Icon name="check_circle" className="text-[14px]" filled />
              {scanned.length} escaneados
            </span>
          </div>

          {scanned.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low/60 p-3 shadow-xs"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                  type="button"
                  aria-label={`Desmarcar ${item.name}`}
                  disabled={busy}
                  onClick={() => mutate(() => resetListItemFn({ data: { itemId: item.id } }))}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-container text-on-primary"
                >
                  <Icon name="check" className="text-[16px]" />
                </button>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium text-on-surface-variant line-through">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                    <span className="rounded bg-surface-container px-1 text-[10px]">
                      {formatQuantity(item.quantity, 'un')}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-primary">
                      Bipado: {formatBRL(item.scannedPriceCents ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-surface-container-lowest px-2 py-1 text-[10px] font-bold text-primary shadow-xs">
                  <Icon name="done_all" className="text-[14px]" />
                  Carrinho
                </span>
                <button
                  type="button"
                  aria-label={`Remover ${item.name}`}
                  disabled={busy}
                  onClick={() => mutate(() => removeListItemFn({ data: { itemId: item.id } }))}
                  className="text-outline hover:text-error"
                >
                  <Icon name="delete_outline" className="text-[18px]" />
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto flex max-w-lg justify-center px-4">
        <button
          type="button"
          disabled={pending.length === 0}
          onClick={() => pending[0] && openScan(pending[0])}
          className="pointer-events-auto flex w-full items-center justify-center gap-2 rounded-full bg-primary-container py-3.5 text-sm font-bold text-on-primary shadow-xl active:scale-95 disabled:opacity-50"
        >
          <Icon name="barcode_scanner" className="text-[22px]" />
          Escanear próximo item
        </button>
      </div>

      <Sheet open={scanTarget !== null} onClose={() => setScanTarget(null)} title={scanTarget?.name ?? ''}>
        <p className="mb-3 text-xs text-on-surface-variant">
          Confirme o preço e a quantidade para adicionar o item ao carrinho.
        </p>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Preço unitário (R$)
        </label>
        <input
          type="number"
          step="0.01"
          value={scanPrice}
          onChange={(event) => setScanPrice(event.target.value)}
          className="tnum mt-1 w-full rounded-xl bg-surface-container-low p-3 text-2xl font-extrabold text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
        />
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Quantidade
        </label>
        <input
          type="number"
          step="1"
          min="1"
          value={scanQty}
          onChange={(event) => setScanQty(event.target.value)}
          className="tnum mt-1 w-full rounded-xl bg-surface-container-low p-3 text-lg font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          disabled={busy}
          onClick={confirmScan}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container text-sm font-bold text-on-primary disabled:opacity-50"
        >
          <Icon name="check_circle" className="text-[20px]" filled />
          Confirmar e adicionar
        </button>
      </Sheet>
    </div>
  )
}
