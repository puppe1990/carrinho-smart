import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import type { AdminCategoryRecord } from '../server/db/models'
import {
  AdminCell,
  AdminField,
  AdminModal,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  ConfirmDialog,
  adminInputClass,
  ghostButtonClass,
  primaryButtonClass,
} from '../components/admin/primitives'
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
} from '../server/functions/admin'

export const Route = createFileRoute('/admin/categorias')({
  loader: () => fetchAdminCategories(),
  component: AdminCategoriesPage,
})

const COLOR_OPTIONS = [
  { value: 'primary', label: 'Verde' },
  { value: 'secondary', label: 'Âmbar' },
  { value: 'tertiary', label: 'Terciária' },
  { value: 'outline', label: 'Neutra' },
]

interface FormState {
  id?: string
  name: string
  icon: string
  color: string
}

const EMPTY: FormState = { name: '', icon: 'category', color: 'primary' }

function AdminCategoriesPage() {
  const categories = Route.useLoaderData()
  const router = useRouter()
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<AdminCategoryRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form) return
    setBusy(true)
    setError(null)
    const payload = { name: form.name, icon: form.icon, color: form.color }
    const result = form.id
      ? await updateAdminCategory({ data: { ...payload, id: form.id } })
      : await createAdminCategory({ data: payload })
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
    const result = await deleteAdminCategory({ data: { id: deleting.id } })
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
        title="Categorias"
        description="Organize os produtos por categoria."
        action={
          <button type="button" className={primaryButtonClass} onClick={() => setForm(EMPTY)}>
            Nova categoria
          </button>
        }
      />

      {error && !form && !deleting && (
        <div className="mb-4 rounded-xl bg-error-container p-3 text-sm text-on-error-container">
          {error}
        </div>
      )}

      <AdminTable
        columns={[
          { key: 'icon', label: 'Ícone' },
          { key: 'name', label: 'Nome' },
          { key: 'color', label: 'Cor' },
          { key: 'references', label: 'Itens', align: 'right' },
          { key: 'actions', label: '', align: 'right' },
        ]}
        empty={categories.length === 0}
      >
        {categories.map((category) => (
          <AdminRow key={category.id}>
            <AdminCell>
              <span className="material-symbols-outlined text-[20px] text-primary">
                {category.icon}
              </span>
            </AdminCell>
            <AdminCell>
              <span className="font-semibold">{category.name}</span>
            </AdminCell>
            <AdminCell>{category.color}</AdminCell>
            <AdminCell align="right">{category.referenceCount}</AdminCell>
            <AdminCell align="right">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() =>
                    setForm({
                      id: category.id,
                      name: category.name,
                      icon: category.icon,
                      color: category.color,
                    })
                  }
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => {
                    setError(null)
                    setDeleting(category)
                  }}
                >
                  Excluir
                </button>
              </div>
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>

      <AdminModal
        open={form !== null}
        title={form?.id ? 'Editar categoria' : 'Nova categoria'}
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
            placeholder="Ex.: Bebidas"
          />
        </AdminField>
        <AdminField label="Ícone" hint="Nome de um Material Symbol (ex.: local_drink)">
          <input
            className={adminInputClass}
            value={form?.icon ?? ''}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, icon: event.target.value } : prev))
            }
          />
        </AdminField>
        <AdminField label="Cor">
          <select
            className={adminInputClass}
            value={form?.color ?? 'primary'}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, color: event.target.value } : prev))
            }
          >
            {COLOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </AdminField>
      </AdminModal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir categoria"
        busy={busy}
        message={
          error ??
          `Tem certeza que deseja excluir "${deleting?.name ?? ''}"? Categorias com produtos não podem ser excluídas.`
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
