import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { formatBRL, parseBRL } from '../domain/money'
import type { AdminProductRecord } from '../server/db/models'
import {
  AdminCell,
  AdminField,
  AdminModal,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  ConfirmDialog,
  Pagination,
  SearchInput,
  adminInputClass,
  ghostButtonClass,
  primaryButtonClass,
} from '../components/admin/primitives'
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminProducts,
  updateAdminProduct,
} from '../server/functions/admin'
import { useDebouncedValue } from '../hooks/use-debounced-value'

const PAGE_SIZE = 10

interface ProductSearch {
  q?: string
  categoria?: string
  pagina?: number
}

export const Route = createFileRoute('/admin/produtos')({
  validateSearch: (search: Record<string, unknown>): ProductSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    categoria:
      typeof search.categoria === 'string' && search.categoria ? search.categoria : undefined,
    pagina: Number(search.pagina) > 0 ? Number(search.pagina) : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, categoria: search.categoria, pagina: search.pagina }),
  loader: ({ deps }) =>
    fetchAdminProducts({
      data: {
        search: deps.q,
        categoryId: deps.categoria,
        page: deps.pagina ?? 1,
        pageSize: PAGE_SIZE,
      },
    }),
  component: AdminProductsPage,
})

interface FormState {
  id?: string
  name: string
  brand: string
  barcode: string
  categoryId: string
  unit: string
  price: string
  imageUrl: string
  aisle: string
}

function AdminProductsPage() {
  const { items, total, page, pageSize, categories } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<AdminProductRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState(search.q ?? '')
  const debouncedQuery = useDebouncedValue(query)

  function setParam(next: Partial<ProductSearch>) {
    navigate({ search: (prev: ProductSearch) => ({ ...prev, ...next }) })
  }

  useEffect(() => {
    const current = search.q ?? ''
    if (debouncedQuery === current) return
    navigate({
      search: (prev: ProductSearch) => ({
        ...prev,
        q: debouncedQuery || undefined,
        pagina: undefined,
      }),
    })
  }, [debouncedQuery, search.q, navigate])

  function openCreate() {
    setError(null)
    setForm({
      name: '',
      brand: '',
      barcode: '',
      categoryId: categories[0]?.id ?? '',
      unit: 'un',
      price: '',
      imageUrl: '',
      aisle: '',
    })
  }

  function openEdit(product: AdminProductRecord) {
    setError(null)
    setForm({
      id: product.id,
      name: product.name,
      brand: product.brand ?? '',
      barcode: product.barcode,
      categoryId: product.categoryId,
      unit: product.unit,
      price: (product.priceCents / 100).toFixed(2).replace('.', ','),
      imageUrl: product.imageUrl ?? '',
      aisle: product.aisle ?? '',
    })
  }

  async function submit() {
    if (!form) return
    setBusy(true)
    setError(null)
    const payload = {
      name: form.name,
      brand: form.brand || null,
      barcode: form.barcode || null,
      categoryId: form.categoryId,
      unit: form.unit,
      priceCents: parseBRL(form.price),
      imageUrl: form.imageUrl || null,
      aisle: form.aisle || null,
    }
    const result = form.id
      ? await updateAdminProduct({ data: { ...payload, id: form.id } })
      : await createAdminProduct({ data: payload })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setForm(null)
    await router.invalidate()
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    setError(null)
    const result = await deleteAdminProduct({ data: { id: deleting.id } })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDeleting(null)
    await router.invalidate()
  }

  return (
    <div>
      <AdminPageHeader
        title="Produtos"
        description="Catálogo compartilhado usado pelo scanner e pelas listas."
        action={
          <button type="button" className={primaryButtonClass} onClick={openCreate}>
            Novo produto
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} placeholder="Buscar por nome ou marca" onChange={setQuery} />
        <select
          className={`${adminInputClass} max-w-xs`}
          value={search.categoria ?? ''}
          onChange={(event) =>
            setParam({ categoria: event.target.value || undefined, pagina: undefined })
          }
        >
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {error && !form && !deleting && (
        <div className="mb-4 rounded-xl bg-error-container p-3 text-sm text-on-error-container">
          {error}
        </div>
      )}

      <AdminTable
        columns={[
          { key: 'name', label: 'Produto' },
          { key: 'category', label: 'Categoria' },
          { key: 'barcode', label: 'Código' },
          { key: 'price', label: 'Preço', align: 'right' },
          { key: 'usage', label: 'Em uso', align: 'right' },
          { key: 'actions', label: '', align: 'right' },
        ]}
        empty={items.length === 0}
      >
        {items.map((product) => (
          <AdminRow key={product.id}>
            <AdminCell>
              <div className="font-semibold">{product.name}</div>
              <div className="text-[11px] text-on-surface-variant">{product.brand ?? '—'}</div>
            </AdminCell>
            <AdminCell>{product.categoryName}</AdminCell>
            <AdminCell>
              <span className="tnum text-xs">{product.barcode}</span>
            </AdminCell>
            <AdminCell align="right">
              <span className="tnum font-semibold">{formatBRL(product.priceCents)}</span>
            </AdminCell>
            <AdminCell align="right">{product.usageCount}</AdminCell>
            <AdminCell align="right">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => openEdit(product)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => {
                    setError(null)
                    setDeleting(product)
                  }}
                >
                  Excluir
                </button>
              </div>
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={(next) => setParam({ pagina: next === 1 ? undefined : next })}
      />

      <AdminModal
        open={form !== null}
        title={form?.id ? 'Editar produto' : 'Novo produto'}
        onClose={() => {
          setForm(null)
          setError(null)
        }}
        footer={
          <>
            <button type="button" className={ghostButtonClass} onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button type="button" className={primaryButtonClass} disabled={busy} onClick={submit}>
              Salvar
            </button>
          </>
        }
      >
        {error && (
          <div className="rounded-xl bg-error-container p-3 text-sm text-on-error-container">
            {error}
          </div>
        )}
        <AdminField label="Nome">
          <input
            className={adminInputClass}
            value={form?.name ?? ''}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
            }
          />
        </AdminField>
        <div className="grid grid-cols-2 gap-4">
          <AdminField label="Marca">
            <input
              className={adminInputClass}
              value={form?.brand ?? ''}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, brand: event.target.value } : prev))
              }
            />
          </AdminField>
          <AdminField label="Categoria">
            <select
              className={adminInputClass}
              value={form?.categoryId ?? ''}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, categoryId: event.target.value } : prev))
              }
            >
              <option value="">Selecione</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Preço (R$)">
            <input
              className={adminInputClass}
              value={form?.price ?? ''}
              placeholder="0,00"
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, price: event.target.value } : prev))
              }
            />
          </AdminField>
          <AdminField label="Unidade">
            <select
              className={adminInputClass}
              value={form?.unit ?? 'un'}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, unit: event.target.value } : prev))
              }
            >
              <option value="un">Unidade</option>
              <option value="kg">Quilo</option>
              <option value="L">Litro</option>
            </select>
          </AdminField>
        </div>
        <AdminField label="Código de barras" hint="EAN-13. Em branco gera um código interno.">
          <input
            className={adminInputClass}
            value={form?.barcode ?? ''}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, barcode: event.target.value } : prev))
            }
          />
        </AdminField>
        <div className="grid grid-cols-2 gap-4">
          <AdminField label="Corredor">
            <input
              className={adminInputClass}
              value={form?.aisle ?? ''}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, aisle: event.target.value } : prev))
              }
            />
          </AdminField>
          <AdminField label="URL da imagem">
            <input
              className={adminInputClass}
              value={form?.imageUrl ?? ''}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, imageUrl: event.target.value } : prev))
              }
            />
          </AdminField>
        </div>
      </AdminModal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir produto"
        busy={busy}
        message={
          error ??
          `Tem certeza que deseja excluir "${deleting?.name ?? ''}"? Produtos em uso não podem ser excluídos.`
        }
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null)
          setError(null)
        }}
      />
    </div>
  )
}
