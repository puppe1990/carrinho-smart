import { createServerFn } from '@tanstack/react-start'
import { isAdminEmail, requireAdmin } from '../auth/admin'
import { getCurrentUser } from '../auth/session'
import type { AdminCategoryRecord, AdminProductRecord, AdminStoreRecord } from '../db/models'
import {
  createCategory,
  createProduct,
  createStore,
  deleteCategory,
  deleteProduct,
  deleteStore,
  getOverview,
  getUserDetail,
  listCategories,
  listProducts,
  listStores,
  listUsers,
  updateCategory,
  updateProduct,
  updateStore,
} from '../services/admin-service'
import type { CategoryInput, ProductInput, StoreInput } from '../services/admin-service'

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: string }

function toResult<T>(fn: () => T): AdminResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Erro inesperado.' }
  }
}

export const fetchAdminSession = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getCurrentUser()
  return { user, isAdmin: isAdminEmail(user?.email) }
})

export const fetchAdminOverview = createServerFn({ method: 'GET' }).handler(async () => {
  const { repo } = await requireAdmin()
  return getOverview(repo)
})

export const fetchAdminStores = createServerFn({ method: 'GET' }).handler(async () => {
  const { repo } = await requireAdmin()
  return listStores(repo)
})

export const fetchAdminCategories = createServerFn({ method: 'GET' }).handler(async () => {
  const { repo } = await requireAdmin()
  return listCategories(repo)
})

export const fetchAdminProducts = createServerFn({ method: 'GET' })
  .validator(
    (
      data: { search?: string; categoryId?: string; page?: number; pageSize?: number } | undefined,
    ) => data ?? {},
  )
  .handler(async ({ data }) => {
    const { repo } = await requireAdmin()
    return listProducts(repo, data)
  })

export const fetchAdminUsers = createServerFn({ method: 'GET' })
  .validator(
    (data: { search?: string; page?: number; pageSize?: number } | undefined) => data ?? {},
  )
  .handler(async ({ data }) => {
    const { repo } = await requireAdmin()
    return listUsers(repo, data)
  })

export const fetchAdminUserDetail = createServerFn({ method: 'GET' })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { repo } = await requireAdmin()
    return getUserDetail(repo, data.userId)
  })

export const createAdminStore = createServerFn({ method: 'POST' })
  .validator((data: StoreInput) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminStoreRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => createStore(repo, data))
  })

export const updateAdminStore = createServerFn({ method: 'POST' })
  .validator((data: StoreInput & { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminStoreRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => updateStore(repo, data.id, data))
  })

export const deleteAdminStore = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<{ id: string }>> => {
    const { repo } = await requireAdmin()
    return toResult(() => {
      deleteStore(repo, data.id)
      return { id: data.id }
    })
  })

export const createAdminCategory = createServerFn({ method: 'POST' })
  .validator((data: CategoryInput) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminCategoryRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => createCategory(repo, data))
  })

export const updateAdminCategory = createServerFn({ method: 'POST' })
  .validator((data: CategoryInput & { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminCategoryRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => updateCategory(repo, data.id, data))
  })

export const deleteAdminCategory = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<{ id: string }>> => {
    const { repo } = await requireAdmin()
    return toResult(() => {
      deleteCategory(repo, data.id)
      return { id: data.id }
    })
  })

export const createAdminProduct = createServerFn({ method: 'POST' })
  .validator((data: ProductInput) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminProductRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => createProduct(repo, data))
  })

export const updateAdminProduct = createServerFn({ method: 'POST' })
  .validator((data: ProductInput & { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminProductRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => updateProduct(repo, data.id, data))
  })

export const deleteAdminProduct = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<{ id: string }>> => {
    const { repo } = await requireAdmin()
    return toResult(() => {
      deleteProduct(repo, data.id)
      return { id: data.id }
    })
  })
