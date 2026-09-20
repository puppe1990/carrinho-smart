import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import type { AdminStoreRecord } from '../server/db/models'
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
  createAdminStore,
  deleteAdminStore,
  fetchAdminStores,
  updateAdminStore,
} from '../server/functions/admin'

export const Route = createFileRoute('/admin/lojas')({
  loader: () => fetchAdminStores(),
  component: AdminStoresPage,
})

interface FormState {
  id?: string
  name: string
  city: string
}

const EMPTY: FormState = { name: '', city: '' }

function AdminStoresPage() {
  const stores = Route.useLoaderData()
  const router = useRouter()
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<AdminStoreRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form) return
    setBusy(true)
    setError(null)
    const payload = { name: form.name, city: form.city || null }
    const result = form.id
      ? await updateAdminStore({ data: { ...payload, id: form.id } })
      : await createAdminStore({ data: payload })
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
    const result = await deleteAdminStore({ data: { id: deleting.id } })
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
        title="Lojas"
        description="Gerencie os supermercados disponíveis para as compras."
        action={
          <button type="button" className={primaryButtonClass} onClick={() => setForm(EMPTY)}>
            Nova loja
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
          { key: 'name', label: 'Nome' },
          { key: 'city', label: 'Cidade' },
          { key: 'usage', label: 'Em uso', align: 'right' },
          { key: 'actions', label: '', align: 'right' },
        ]}
        empty={stores.length === 0}
      >
        {stores.map((store) => (
          <AdminRow key={store.id}>
            <AdminCell>
              <span className="font-semibold">{store.name}</span>
            </AdminCell>
            <AdminCell>{store.city ?? '—'}</AdminCell>
            <AdminCell align="right">{store.usageCount}</AdminCell>
            <AdminCell align="right">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() =>
                    setForm({ id: store.id, name: store.name, city: store.city ?? '' })
                  }
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => {
                    setError(null)
                    setDeleting(store)
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
        title={form?.id ? 'Editar loja' : 'Nova loja'}
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
            placeholder="Ex.: Pão de Açúcar - Morumbi"
          />
        </AdminField>
        <AdminField label="Cidade">
          <input
            className={adminInputClass}
            value={form?.city ?? ''}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, city: event.target.value } : prev))
            }
            placeholder="Ex.: São Paulo"
          />
        </AdminField>
      </AdminModal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir loja"
        busy={busy}
        message={
          error ??
          `Tem certeza que deseja excluir "${deleting?.name ?? ''}"? Lojas em uso não podem ser excluídas.`
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
