import { useMemo, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Icon } from '../components/Icon'
import { SegmentedBudgetBar, SubHeader } from '../components/ui'
import { budgetGauge } from '../domain/budget'
import { parseBRL, formatBRL, formatPercent } from '../domain/money'
import { fetchCartOverview } from '../server/functions/cart'
import { lookupProduct, scanProduct, searchCatalog } from '../server/functions/scanner'

export const Route = createFileRoute('/scanner')({
  loader: async () => {
    const [overview, products] = await Promise.all([
      fetchCartOverview({ data: {} }),
      searchCatalog({ data: { query: '' } }),
    ])
    return { overview, products }
  },
  component: ScannerPage,
})

function ScannerPage() {
  const { overview, products } = Route.useLoaderData()
  const router = useRouter()

  const [torch, setTorch] = useState(false)
  const [productId, setProductId] = useState<string | null>(products[0]?.id ?? null)
  const [trend, setTrend] = useState<{ direction: string; percent: number } | null>(null)
  const [previousPriceCents, setPreviousPriceCents] = useState<number | null>(null)
  const [price, setPrice] = useState(
    products[0] ? (products[0].priceCents / 100).toFixed(2) : '0.00',
  )
  const [quantity, setQuantity] = useState(1)
  const [promo, setPromo] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const product = useMemo(
    () => products.find((candidate) => candidate.id === productId) ?? null,
    [products, productId],
  )

  const unitPriceCents = parseBRL(promo ? String(Number(price) * 0.9) : price)
  const subtotalCents = Math.round(unitPriceCents * quantity)
  const gauge = budgetGauge(overview.summary.totalCents, subtotalCents, overview.budget.limitCents)

  async function simulateScan() {
    const pool = products.filter((candidate) => candidate.id !== productId)
    const candidate = pool[Math.floor(Math.random() * pool.length)] ?? products[0]
    if (!candidate) return
    const lookup = await lookupProduct({
      data: { barcode: candidate.barcode, storeId: overview.store?.id },
    })
    setProductId(candidate.id)
    setQuantity(1)
    setPromo(false)
    setPrice((candidate.priceCents / 100).toFixed(2))
    if (lookup) {
      setTrend(lookup.trend)
      setPreviousPriceCents(lookup.previousPriceCents)
    }
  }

  function selectProduct(id: string) {
    const candidate = products.find((item) => item.id === id)
    if (!candidate) return
    setProductId(id)
    setPrice((candidate.priceCents / 100).toFixed(2))
    setQuantity(1)
    setPromo(false)
    setTrend(null)
    setPreviousPriceCents(null)
    setShowSearch(false)
    setQuery('')
  }

  async function handleAdd() {
    if (!product) return
    setSaving(true)
    try {
      await scanProduct({
        data: {
          cartId: overview.cart.id,
          line: {
            productId: product.id,
            barcode: product.barcode,
            name: product.name,
            brand: product.brand,
            categoryId: product.categoryId,
            unit: product.unit,
            unitPriceCents,
            listPriceCents: promo ? product.priceCents : unitPriceCents,
            quantity,
            promo,
            isWeighed: product.unit === 'kg',
          },
        },
      })
      setSaved(true)
      await router.invalidate()
      setTimeout(() => router.navigate({ to: '/' }), 500)
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = query.trim()
    ? products.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    : products.slice(0, 12)

  return (
    <div className="flex min-h-screen flex-col pb-8">
      <SubHeader title="Product Scanner" subtitle="Bipe o código de barras do produto" />

      <div className="relative h-[360px] w-full overflow-hidden bg-inverse-surface">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(0,0,0,0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-inverse-surface/80 via-transparent to-inverse-surface/90" />

        <div className="relative z-20 flex items-center justify-between p-4">
          <button
            type="button"
            aria-label="Fechar scanner"
            onClick={() => router.history.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-inverse-surface/70 text-surface backdrop-blur-md active:scale-95"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTorch((value) => !value)}
              className={`flex h-11 items-center gap-1 rounded-full px-4 text-[11px] font-semibold backdrop-blur-md active:scale-95 ${
                torch
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-inverse-surface/70 text-surface'
              }`}
            >
              <Icon name={torch ? 'flash_on' : 'flash_off'} className="text-[20px]" />
              {torch ? 'Acesa' : 'Lanterna'}
            </button>
            <button
              type="button"
              title="Digitar código manualmente"
              onClick={() => setShowSearch((value) => !value)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-inverse-surface/70 text-surface backdrop-blur-md active:scale-95"
            >
              <Icon name="keyboard" className="text-[22px]" />
            </button>
          </div>
        </div>

        <div className="relative z-10 mx-auto flex h-44 w-64 flex-col items-center justify-center">
          <div className="pointer-events-none absolute inset-0 rounded-2xl">
            <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-xl border-l-4 border-t-4 border-primary-fixed" />
            <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-xl border-r-4 border-t-4 border-primary-fixed" />
            <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-xl border-b-4 border-l-4 border-primary-fixed" />
            <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-xl border-b-4 border-r-4 border-primary-fixed" />
          </div>
          <div className="w-full px-2">
            <div className="h-0.5 w-full animate-pulse bg-gradient-to-r from-transparent via-primary-fixed to-transparent shadow-[0_0_12px_#6ffbbe]" />
          </div>
          <div className="mt-4 flex items-center gap-1 rounded-full bg-primary-fixed px-3 py-1 text-on-primary-fixed shadow-md">
            <Icon name="qr_code_scanner" className="text-[16px]" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Código detectado</span>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-2 pb-3">
          <p className="text-xs text-surface drop-shadow">
            Aponte a câmera para o código de barras ou QR Code
          </p>
          <button
            type="button"
            onClick={simulateScan}
            className="rounded-full bg-primary-fixed/90 px-4 py-1.5 text-[11px] font-bold text-on-primary-fixed active:scale-95"
          >
            Simular leitura de código
          </button>
        </div>
      </div>

      <div className="relative z-30 -mt-6 flex flex-col rounded-t-3xl bg-surface-container-lowest px-4 pb-8 pt-5 shadow-xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-surface-container-highest" />

        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 rounded-full bg-primary-container/15 px-3 py-1 text-primary">
            <Icon name="check_circle" className="text-[18px]" filled />
            <span className="text-xs font-semibold">Produto identificado</span>
          </div>
          <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
            {product ? `EAN ${product.barcode}` : 'EAN --'}
          </span>
        </div>

        {product ? (
          <div className="mb-4 flex items-center gap-4 rounded-2xl bg-surface-container-low p-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary shadow-sm">
              <Icon name="grocery" className="text-[30px]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold text-on-surface">{product.name}</h2>
              <p className="truncate text-[11px] text-on-surface-variant">
                {product.brand ?? 'Sem marca'} · {product.aisle ?? ''}
              </p>
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                className="mt-1 flex items-center gap-0.5 text-[11px] text-primary"
              >
                Não é este produto? Corrigir
                <Icon name="edit" className="text-[12px]" />
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-2xl bg-surface-container-low p-4 text-center text-xs text-on-surface-variant">
            Nenhum produto selecionado. Simule uma leitura ou busque no catálogo.
          </div>
        )}

        {showSearch && (
          <div className="mb-4 rounded-2xl bg-surface-container-low p-3">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produto por nome..."
              className="h-11 w-full rounded-xl bg-surface-container-lowest px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="no-scrollbar mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
              {filteredProducts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectProduct(item.id)}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-surface-container"
                >
                  <span className="truncate text-xs font-medium text-on-surface">{item.name}</span>
                  <span className="tnum shrink-0 text-[11px] text-on-surface-variant">
                    {formatBRL(item.priceCents)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 grid grid-cols-12 gap-3">
          <div className="col-span-7 flex flex-col justify-between rounded-2xl bg-surface-container-low p-3 shadow-sm">
            <label
              htmlFor="shelf-price"
              className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
            >
              Preço na etiqueta (R$)
            </label>
            <div className="my-1 flex items-baseline gap-1">
              <span className="text-sm font-bold text-on-surface">R$</span>
              <input
                id="shelf-price"
                type="number"
                step="0.10"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="tnum w-full bg-transparent text-3xl font-extrabold tracking-tight text-on-surface outline-none"
              />
            </div>
            {previousPriceCents !== null && previousPriceCents !== unitPriceCents && (
              <div
                className={`flex items-center gap-1 text-[10px] font-semibold ${
                  trend?.direction === 'down' ? 'text-primary' : 'text-secondary'
                }`}
              >
                <Icon
                  name={trend?.direction === 'down' ? 'trending_down' : 'trending_up'}
                  className="text-[14px]"
                />
                Última compra: {formatBRL(previousPriceCents)}
              </div>
            )}
          </div>

          <div className="col-span-5 flex flex-col items-center justify-between rounded-2xl bg-surface-container-low p-3 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Quantidade
            </span>
            <div className="mt-1 flex w-full items-center justify-between">
              <button
                type="button"
                aria-label="Diminuir unidade"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest text-on-surface shadow-sm active:scale-90"
              >
                <Icon name="remove" className="text-[20px]" />
              </button>
              <span className="tnum px-1 text-lg font-bold text-on-surface">{quantity}</span>
              <button
                type="button"
                aria-label="Adicionar unidade"
                onClick={() => setQuantity((value) => value + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest text-on-surface shadow-sm active:scale-90"
              >
                <Icon name="add" className="text-[20px]" />
              </button>
            </div>
            <span className="text-[10px] text-on-surface-variant">
              {product?.unit === 'kg' ? 'Peso (kg)' : 'Unidade'}
            </span>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-2xl bg-secondary-fixed/40 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container">
              <Icon name="sell" className="text-[20px]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-on-surface">Ativar preço promocional?</p>
              <p className="text-[11px] text-on-surface-variant">Aplica 10% de desconto de clube</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={promo}
            onClick={() => setPromo((value) => !value)}
            className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
              promo ? 'bg-primary' : 'bg-outline-variant'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                promo ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="mb-5 flex flex-col gap-1 rounded-2xl bg-surface-container-low p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-on-surface-variant">
              <Icon name="account_balance_wallet" className="text-[16px] text-primary" />
              Meta de gasto ({formatBRL(overview.budget.limitCents)})
            </span>
            <span className={`font-bold ${gauge.over ? 'text-error' : 'text-secondary'}`}>
              {formatPercent(gauge.totalPercent)}
            </span>
          </div>
          <SegmentedBudgetBar
            basePercent={gauge.basePercent}
            deltaPercent={gauge.deltaPercent}
            over={gauge.over}
          />
          <div className="flex items-center justify-between pt-1 text-[11px] text-on-surface-variant">
            <span>Anterior: {formatBRL(overview.summary.totalCents)}</span>
            <span className="font-semibold text-on-surface">
              Novo total: {formatBRL(overview.summary.totalCents + subtotalCents)}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={!product || saving}
          onClick={handleAdd}
          className={`flex h-14 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
            saved
              ? 'bg-primary text-on-primary'
              : 'bg-primary-container text-on-primary-container shadow-lg'
          }`}
        >
          <Icon name={saved ? 'done_all' : 'shopping_cart_checkout'} className="text-[22px]" filled />
          {saved ? 'Item adicionado!' : `Adicionar ao carrinho (+ ${formatBRL(subtotalCents)})`}
        </button>
      </div>
    </div>
  )
}
