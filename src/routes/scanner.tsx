import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Icon } from '../components/Icon'
import {
  MissingProductActions,
  RegisterMissingProductForm,
  type RegisterMissingProductInput,
} from '../components/RegisterMissingProduct'
import { SegmentedBudgetBar, Sheet, SubHeader } from '../components/ui'
import { budgetGauge } from '../domain/budget'
import { classifyBarcode, isValidEan13, normalizeBarcode } from '../domain/barcode'
import { formatBRL, formatPercent, parseBRL } from '../domain/money'
import { useBarcodeCamera } from '../hooks/use-barcode-camera'
import {
  createAdminProduct,
  fetchAdminCategories,
  fetchAdminSession,
} from '../server/functions/admin'
import { fetchCartOverview } from '../server/functions/cart'
import { fetchMonthBudget } from '../server/functions/history'
import { lookupProduct, scanProduct } from '../server/functions/scanner'

export const Route = createFileRoute('/scanner')({
  loader: async () => {
    const [overview, monthBudget, adminSession] = await Promise.all([
      fetchCartOverview({ data: {} }),
      fetchMonthBudget(),
      fetchAdminSession(),
    ])
    const categories = adminSession.isAdmin ? await fetchAdminCategories() : []
    return { overview, monthBudget, isAdmin: adminSession.isAdmin, categories }
  },
  component: ScannerPage,
})

type LookupResult = Awaited<ReturnType<typeof lookupProduct>>

function ScannerPage() {
  const { overview, monthBudget, isAdmin, categories } = Route.useLoaderData()
  const router = useRouter()

  const [torchOn, setTorchOn] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [lookup, setLookup] = useState<LookupResult>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [productMissing, setProductMissing] = useState(false)
  const [searching, setSearching] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)

  const [price, setPrice] = useState('0.00')
  const [quantity, setQuantity] = useState(1)
  const [promo, setPromo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const inFlightRef = useRef(false)

  const product = lookup?.product ?? null
  const unitPriceCents = promo ? Math.round(parseBRL(price) * 0.9) : parseBRL(price)
  const subtotalCents = Math.round(unitPriceCents * quantity)
  const gauge = budgetGauge(
    monthBudget.spentCents + overview.summary.totalCents,
    subtotalCents,
    monthBudget.budgetCents,
  )

  const handleDetect = async (code: string) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLastCode(code)
    setLookupError(null)
    setProductMissing(false)
    setSearching(true)
    try {
      const result = await lookupProduct({
        data: { barcode: code, storeId: overview.store?.id },
      })
      setLookup(result)
      if (result) {
        setPrice((result.suggestedPriceCents / 100).toFixed(2))
        setQuantity(1)
        setPromo(false)
      } else {
        setProductMissing(true)
        setLookupError(`Nenhum produto cadastrado para o código ${code}.`)
      }
    } catch {
      setLookupError('Não foi possível consultar o catálogo. Tente novamente.')
    } finally {
      setSearching(false)
      inFlightRef.current = false
    }
  }

  const camera = useBarcodeCamera({ onDetect: (code) => void handleDetect(code) })

  useEffect(() => {
    void camera.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const track = camera.videoRef.current?.srcObject as MediaStream | undefined
    const capabilities = track?.getVideoTracks?.()[0]?.getCapabilities?.() as
      { torch?: boolean } | undefined
    if (!capabilities?.torch) return
    const videoTrack = track!.getVideoTracks()[0]
    void videoTrack.applyConstraints({ advanced: [{ torch: torchOn } as MediaTrackConstraintSet] })
  }, [torchOn, camera.videoRef])

  const formatLabel = useMemo(() => {
    if (!lastCode) return null
    const format = classifyBarcode(lastCode)
    const labels: Record<string, string> = {
      ean13: 'EAN-13',
      ean8: 'EAN-8',
      upc: 'UPC',
      itf: 'ITF-14',
      code128: 'Code 128',
      unknown: 'Código',
    }
    return labels[format] ?? format
  }, [lastCode])

  async function handleRegister(input: RegisterMissingProductInput) {
    setRegistering(true)
    setRegisterError(null)
    try {
      const result = await createAdminProduct({
        data: {
          barcode: input.barcode,
          name: input.name,
          brand: input.brand,
          categoryId: input.categoryId,
          unit: input.unit,
          priceCents: input.priceCents,
          aisle: input.aisle,
        },
      })
      if (!result.ok) {
        setRegisterError(result.error)
        return
      }
      setRegisterOpen(false)
      setPrice((input.priceCents / 100).toFixed(2))
      inFlightRef.current = false
      await handleDetect(input.barcode)
    } catch {
      setRegisterError('Não foi possível cadastrar o produto. Tente novamente.')
    } finally {
      setRegistering(false)
    }
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
      setTimeout(() => router.navigate({ to: '/' }), 450)
    } finally {
      setSaving(false)
    }
  }

  const statusCopy: Record<typeof camera.status, string> = {
    idle: 'Aponte a câmera para o código de barras',
    starting: 'Iniciando câmera...',
    running: camera.videoRef.current ? 'Procurando código de barras...' : 'Aponte a câmera',
    error: 'Câmera indisponível',
  }

  return (
    <div className="flex min-h-screen flex-col pb-8">
      <SubHeader title="Scanner de produtos" subtitle="Leitura real pela câmera do dispositivo" />

      <div className="relative h-[360px] w-full overflow-hidden bg-inverse-surface">
        <video
          ref={camera.videoRef}
          muted
          playsInline
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            camera.status === 'running' ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-inverse-surface/70 via-transparent to-inverse-surface/90" />

        <div className="relative z-20 flex items-center justify-between p-4">
          <button
            type="button"
            aria-label="Fechar scanner"
            onClick={() => {
              camera.stop()
              router.history.back()
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-inverse-surface/70 text-surface backdrop-blur-md active:scale-95"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Lanterna"
              onClick={() => setTorchOn((value) => !value)}
              className={`flex h-11 items-center gap-1 rounded-full px-4 text-[11px] font-semibold backdrop-blur-md active:scale-95 ${
                torchOn
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-inverse-surface/70 text-surface'
              }`}
            >
              <Icon name={torchOn ? 'flash_on' : 'flash_off'} className="text-[20px]" />
              {torchOn ? 'Acesa' : 'Lanterna'}
            </button>
            <button
              type="button"
              title="Digitar código manualmente"
              onClick={() => setManualOpen(true)}
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
          {searching && (
            <div className="mt-4 flex items-center gap-1 rounded-full bg-primary-fixed px-3 py-1 text-on-primary-fixed shadow-md">
              <Icon name="progress_activity" className="animate-spin text-[16px]" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Consultando</span>
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-col items-center gap-2 pb-3">
          <p className="text-xs text-surface drop-shadow">{statusCopy[camera.status]}</p>
          {camera.status === 'running' && (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="rounded-full bg-primary-fixed/90 px-4 py-1.5 text-[11px] font-bold text-on-primary-fixed active:scale-95"
            >
              Digitar o código
            </button>
          )}
          {camera.status === 'error' && (
            <button
              type="button"
              onClick={() => void camera.start()}
              className="rounded-full bg-secondary-container px-4 py-1.5 text-[11px] font-bold text-on-secondary-container active:scale-95"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>

      <div className="relative z-30 -mt-6 flex flex-col rounded-t-3xl bg-surface-container-lowest px-4 pb-8 pt-5 shadow-xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-surface-container-highest" />

        <div className="mb-3 flex items-center justify-between gap-2">
          <div
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${
              product
                ? 'bg-primary-container/15 text-primary'
                : lookupError
                  ? 'bg-error-container text-on-error-container'
                  : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            <Icon
              name={product ? 'check_circle' : lookupError ? 'error' : 'qr_code_scanner'}
              className="text-[18px]"
              filled={Boolean(product)}
            />
            <span className="text-xs font-semibold">
              {product
                ? 'Produto identificado'
                : lookupError
                  ? 'Não encontrado'
                  : 'Aguardando leitura'}
            </span>
          </div>
          <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
            {lastCode ? `${formatLabel} ${lastCode}` : 'EAN --'}
          </span>
        </div>

        {camera.error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-error-container p-3 text-on-error-container">
            <Icon name="videocam_off" className="text-[18px]" />
            <span className="text-[11px] font-medium">{camera.error}</span>
          </div>
        )}

        {camera.autoDetectUnsupported && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-secondary-fixed/50 p-3 text-on-secondary-container">
            <Icon name="info" className="text-[18px]" />
            <span className="text-[11px] font-medium">
              Não foi possível ativar a leitura automática neste navegador. Use "Digitar o código"
              para informar o EAN manualmente.
            </span>
          </div>
        )}

        {camera.usingFallback && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-surface-container p-3 text-on-surface-variant">
            <Icon name="auto_awesome" className="text-[18px] text-primary" />
            <span className="text-[11px] font-medium">
              Leitura automática ativa em modo de compatibilidade. Aponte a câmera para o código.
            </span>
          </div>
        )}

        {lookupError && (
          <MissingProductActions
            message={lookupError}
            isAdmin={isAdmin && productMissing}
            onCorrectCode={() => setManualOpen(true)}
            onRegister={() => {
              setRegisterError(null)
              setRegisterOpen(true)
            }}
          />
        )}

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
              {lookup && lookup.previousRecordedAt && (
                <p className="mt-0.5 text-[11px] text-on-surface-variant">
                  Última compra: {formatBRL(lookup.previousPriceCents)} (
                  {lookup.trend.direction === 'flat'
                    ? 'mesmo preço'
                    : `${lookup.trend.direction === 'up' ? '+' : '-'}${lookup.trend.percent}%`}
                  )
                </p>
              )}
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="mt-1 flex items-center gap-0.5 text-[11px] text-primary"
              >
                Não é este produto? Corrigir
                <Icon name="edit" className="text-[12px]" />
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-2xl bg-surface-container-low p-4 text-center text-xs text-on-surface-variant">
            {searching
              ? 'Consultando o catálogo...'
              : 'Aproxime o código de barras da câmera. Se a leitura falhar, digite o código manualmente.'}
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
                min="0"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="tnum w-full bg-transparent text-3xl font-extrabold tracking-tight text-on-surface outline-none"
              />
            </div>
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
              Meta do mês (
              {monthBudget.budgetCents > 0 ? formatBRL(monthBudget.budgetCents) : 'definir'})
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
            <span>
              Mês {formatBRL(monthBudget.spentCents)} + carrinho{' '}
              {formatBRL(overview.summary.totalCents)}
            </span>
            <span className="font-semibold text-on-surface">
              Novo total:{' '}
              {formatBRL(monthBudget.spentCents + overview.summary.totalCents + subtotalCents)}
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
          <Icon
            name={saved ? 'done_all' : 'shopping_cart_checkout'}
            className="text-[22px]"
            filled
          />
          {saved ? 'Item adicionado!' : `Adicionar ao carrinho (+ ${formatBRL(subtotalCents)})`}
        </button>
      </div>

      <Sheet
        open={registerOpen}
        onClose={() => {
          if (registering) return
          setRegisterOpen(false)
          setRegisterError(null)
        }}
        title="Cadastrar produto"
      >
        {lastCode ? (
          <RegisterMissingProductForm
            key={lastCode}
            barcode={lastCode}
            categories={categories}
            initialPrice={price}
            busy={registering}
            error={registerError}
            onSubmit={handleRegister}
          />
        ) : (
          <p className="text-xs text-on-surface-variant">
            Leia ou digite um código de barras antes de cadastrar o produto.
          </p>
        )}
      </Sheet>

      <Sheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Digitar código de barras"
      >
        <p className="mb-3 text-xs text-on-surface-variant">
          Informe o código impresso na embalagem (EAN-13, EAN-8, UPC ou Code 128).
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const code = normalizeBarcode(manualCode)
            if (!code) return
            setManualOpen(false)
            setManualCode('')
            void handleDetect(code)
          }}
          className="flex flex-col gap-3"
        >
          <input
            autoFocus
            inputMode="numeric"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="Ex.: 7891000000014"
            className="tnum h-12 w-full rounded-xl bg-surface-container-low px-3 text-lg font-bold tracking-wider text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3">
            <Icon
              name={
                manualCode.length === 0
                  ? 'info'
                  : isValidEan13(normalizeBarcode(manualCode))
                    ? 'verified'
                    : 'help'
              }
              className="text-[18px] text-primary"
            />
            <span className="text-[11px] text-on-surface-variant">
              {manualCode.length === 0
                ? 'Digite os dígitos do código.'
                : isValidEan13(normalizeBarcode(manualCode))
                  ? 'EAN-13 válido — dígito verificador confere.'
                  : `Formato detectado: ${classifyBarcode(normalizeBarcode(manualCode))}.`}
            </span>
          </div>
          <button
            type="submit"
            disabled={!normalizeBarcode(manualCode)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container text-sm font-bold text-on-primary disabled:opacity-50"
          >
            <Icon name="search" className="text-[20px]" />
            Consultar no catálogo
          </button>
        </form>
      </Sheet>
    </div>
  )
}
