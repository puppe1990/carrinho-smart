import { useState } from 'react'
import { isValidEan13, normalizeBarcode } from '../domain/barcode'
import { parseBRL } from '../domain/money'
import { Icon } from './Icon'

export interface MissingProductCategory {
  id: string
  name: string
}

export interface RegisterMissingProductInput {
  barcode: string
  name: string
  brand: string | null
  categoryId: string
  unit: string
  priceCents: number
  aisle: string | null
}

const fieldClass =
  'h-11 w-full rounded-xl bg-surface-container-low px-3 text-sm font-medium text-on-surface outline-none focus:ring-2 focus:ring-primary/40'

export function MissingProductActions({
  message,
  isAdmin,
  onCorrectCode,
  onRegister,
}: {
  message: string
  isAdmin: boolean
  onCorrectCode: () => void
  onRegister: () => void
}) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-xl bg-secondary-fixed/50 p-3 text-on-secondary-container">
      <Icon name="info" className="text-[18px]" />
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium">{message}</span>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onCorrectCode}
            className="self-start text-[11px] font-bold underline"
          >
            Corrigir código
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={onRegister}
              className="self-start text-[11px] font-bold underline"
            >
              Cadastrar produto
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function RegisterMissingProductForm({
  barcode,
  categories,
  initialPrice,
  busy = false,
  error = null,
  onSubmit,
}: {
  barcode: string
  categories: MissingProductCategory[]
  initialPrice: string
  busy?: boolean
  error?: string | null
  onSubmit: (input: RegisterMissingProductInput) => void | Promise<void>
}) {
  const [barcodeValue, setBarcodeValue] = useState(barcode)
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [unit, setUnit] = useState('un')
  const [price, setPrice] = useState(initialPrice)
  const [aisle, setAisle] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const noCategories = categories.length === 0
  const displayError = localError ?? error

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (noCategories) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setLocalError('Informe o nome do produto para cadastrá-lo.')
      return
    }
    if (!categoryId) {
      setLocalError('Selecione uma categoria para cadastrar o produto.')
      return
    }
    const normalized = normalizeBarcode(barcodeValue)
    if (!normalized) {
      setLocalError('Informe o código de barras do produto.')
      return
    }
    if (normalized.length === 13 && !isValidEan13(normalized)) {
      setLocalError(
        'Código de barras EAN-13 inválido. Confira os dígitos ou corrija o código lido.',
      )
      return
    }
    setLocalError(null)
    void onSubmit({
      barcode: normalized,
      name: trimmedName,
      brand: brand.trim() || null,
      categoryId,
      unit,
      priceCents: parseBRL(price),
      aisle: aisle.trim() || null,
    })
  }

  return (
    <form
      aria-label="Cadastrar produto ausente"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      <p className="text-xs text-on-surface-variant">
        O código {barcode} não está no catálogo. Preencha os dados para cadastrar e bipar em
        seguida.
      </p>
      {displayError && (
        <div className="rounded-xl bg-error-container p-3 text-[11px] font-medium text-on-error-container">
          {displayError}
        </div>
      )}
      {noCategories && (
        <div className="rounded-xl bg-secondary-fixed/50 p-3 text-[11px] font-medium text-on-secondary-container">
          Cadastre uma categoria no painel admin antes de adicionar este produto.
        </div>
      )}
      <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
        Código de barras
        <input
          className={`${fieldClass} tnum`}
          value={barcodeValue}
          onChange={(event) => setBarcodeValue(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
        Nome
        <input
          className={fieldClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Marca
          <input
            className={fieldClass}
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Categoria
          <select
            className={fieldClass}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={noCategories}
          >
            {noCategories && <option value="">Sem categorias</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Preço (R$)
          <input
            className={`${fieldClass} tnum`}
            value={price}
            placeholder="0,00"
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Unidade
          <select
            className={fieldClass}
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          >
            <option value="un">Unidade</option>
            <option value="kg">Quilo</option>
            <option value="L">Litro</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
        Corredor
        <input
          className={fieldClass}
          value={aisle}
          onChange={(event) => setAisle(event.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={busy || noCategories}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container text-sm font-bold text-on-primary disabled:opacity-50"
      >
        <Icon name="add_box" className="text-[20px]" />
        Cadastrar produto
      </button>
    </form>
  )
}
