import { isValidEan13, normalizeBarcode } from '../../domain/barcode'
import type {
  AdminCategoryRecord,
  AdminProductRecord,
  AdminStoreRecord,
  AdminUserRecord,
  Unit,
} from '../db/models'
import type { Repository } from '../db/repositories'
import { uniqueSlug } from '../db/slug'
import type {
  AdminOverview,
  AdminProductList,
  AdminUserDetail,
  ListResult,
  PageFilter,
} from './admin-types'

const COLORS = ['primary', 'secondary', 'tertiary', 'outline']
const UNITS: Unit[] = ['un', 'kg', 'L']
const MAX_NAME = 120

function requireName(value: string | undefined, label: string): string {
  const name = (value ?? '').trim()
  if (!name) throw new Error(`${label} é obrigatório.`)
  if (name.length > MAX_NAME) throw new Error(`${label} deve ter no máximo ${MAX_NAME} caracteres.`)
  return name
}

function optional(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed ? trimmed : null
}

function resolveColor(value?: string): string {
  const color = (value ?? 'primary').trim()
  if (!COLORS.includes(color)) throw new Error('Cor da categoria inválida.')
  return color
}

export interface StoreInput {
  name: string
  city?: string | null
}

export function listStores(repo: Repository): AdminStoreRecord[] {
  return repo.stores.adminList()
}

export function createStore(repo: Repository, input: StoreInput): AdminStoreRecord {
  const name = requireName(input.name, 'Nome da loja')
  const id = uniqueSlug(name, (candidate) => repo.stores.get(candidate) !== null)
  repo.stores.insert({ id, name, city: optional(input.city) })
  return repo.stores.adminGet(id)!
}

export function updateStore(repo: Repository, id: string, input: StoreInput): AdminStoreRecord {
  const current = repo.stores.get(id)
  if (!current) throw new Error('Loja não encontrada.')
  const name = requireName(input.name, 'Nome da loja')
  repo.stores.update(id, {
    name,
    city: input.city === undefined ? current.city : optional(input.city),
  })
  return repo.stores.adminGet(id)!
}

export function deleteStore(repo: Repository, id: string): void {
  const store = repo.stores.get(id)
  if (!store) throw new Error('Loja não encontrada.')
  const usage = repo.stores.countUsage(id)
  if (usage > 0) {
    throw new Error(`Não é possível excluir: ${usage} registro(s) usam esta loja.`)
  }
  repo.stores.remove(id)
}

export interface CategoryInput {
  name: string
  icon?: string
  color?: string
}

export function listCategories(repo: Repository): AdminCategoryRecord[] {
  return repo.categories.adminList()
}

export function createCategory(repo: Repository, input: CategoryInput): AdminCategoryRecord {
  const name = requireName(input.name, 'Nome da categoria')
  const id = uniqueSlug(name, (candidate) => repo.categories.get(candidate) !== null)
  repo.categories.insert({
    id,
    name,
    icon: optional(input.icon) ?? 'category',
    color: resolveColor(input.color),
  })
  return repo.categories.adminGet(id)!
}

export function updateCategory(
  repo: Repository,
  id: string,
  input: CategoryInput,
): AdminCategoryRecord {
  const current = repo.categories.get(id)
  if (!current) throw new Error('Categoria não encontrada.')
  repo.categories.update(id, {
    name: requireName(input.name, 'Nome da categoria'),
    icon: input.icon === undefined ? current.icon : (optional(input.icon) ?? 'category'),
    color: input.color === undefined ? current.color : resolveColor(input.color),
  })
  return repo.categories.adminGet(id)!
}

export function deleteCategory(repo: Repository, id: string): void {
  const current = repo.categories.get(id)
  if (!current) throw new Error('Categoria não encontrada.')
  const count = repo.categories.countReferences(id)
  if (count > 0) {
    throw new Error(`Não é possível excluir: ${count} registro(s) usam esta categoria.`)
  }
  repo.categories.remove(id)
}

function resolveBarcode(
  repo: Repository,
  raw: string | null | undefined,
  currentId?: string,
): string {
  const value = (raw ?? '').trim()
  if (!value) {
    if (currentId) {
      const current = repo.products.get(currentId)
      if (current) return current.barcode
    }
    return internalBarcode()
  }
  if (currentId && repo.products.get(currentId)?.barcode === value) return value
  if (/^INT-/i.test(value)) {
    const existing = repo.products.findByBarcode(value)
    if (existing && existing.id !== currentId) {
      throw new Error('Já existe um produto com este código de barras.')
    }
    return value
  }
  const normalized = normalizeBarcode(value)
  if (normalized.length === 13 && !isValidEan13(normalized)) {
    throw new Error('Código de barras EAN-13 inválido.')
  }
  const existing = repo.products.findByBarcode(normalized)
  if (existing && existing.id !== currentId) {
    throw new Error('Já existe um produto com este código de barras.')
  }
  return normalized
}

function internalBarcode(): string {
  const suffix = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  return `INT-${suffix}`
}

function resolvePriceCents(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0
  if (!Number.isFinite(value) || value < 0) throw new Error('Preço inválido.')
  return Math.round(value)
}

function resolveUnit(value?: string): Unit {
  const unit = (value ?? 'un').trim()
  if (!UNITS.includes(unit as Unit)) throw new Error('Unidade inválida.')
  return unit as Unit
}

function requireCategory(repo: Repository, categoryId: string | undefined): string {
  const id = (categoryId ?? '').trim()
  if (!id || !repo.categories.get(id)) throw new Error('Selecione uma categoria válida.')
  return id
}

function clampPage(filter: PageFilter): { page: number; pageSize: number } {
  const rawPage = Number(filter.page)
  const rawSize = Number(filter.pageSize)
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
  const pageSize = Number.isFinite(rawSize) ? Math.min(100, Math.max(1, Math.floor(rawSize))) : 20
  return { page, pageSize }
}

export interface ProductInput {
  barcode?: string | null
  name: string
  brand?: string | null
  categoryId: string
  unit?: string
  priceCents?: number | null
  imageUrl?: string | null
  aisle?: string | null
}

export function listProducts(
  repo: Repository,
  filter: PageFilter & { categoryId?: string } = {},
): AdminProductList {
  const { page, pageSize } = clampPage(filter)
  const items = repo.products.adminList({
    search: filter.search,
    categoryId: filter.categoryId,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })
  const total = repo.products.adminCount({ search: filter.search, categoryId: filter.categoryId })
  return { items, total, page, pageSize, categories: repo.categories.adminList() }
}

export function createProduct(repo: Repository, input: ProductInput): AdminProductRecord {
  const name = requireName(input.name, 'Nome do produto')
  const id = uniqueSlug(name, (candidate) => repo.products.get(candidate) !== null)
  repo.products.insert({
    id,
    barcode: resolveBarcode(repo, input.barcode),
    name,
    brand: optional(input.brand),
    categoryId: requireCategory(repo, input.categoryId),
    unit: resolveUnit(input.unit),
    priceCents: resolvePriceCents(input.priceCents),
    imageUrl: optional(input.imageUrl),
    aisle: optional(input.aisle),
  })
  return repo.products.adminGet(id)!
}

export function updateProduct(
  repo: Repository,
  id: string,
  input: ProductInput,
): AdminProductRecord {
  const current = repo.products.get(id)
  if (!current) throw new Error('Produto não encontrado.')
  repo.products.update(id, {
    barcode: resolveBarcode(repo, input.barcode, id),
    name: requireName(input.name, 'Nome do produto'),
    brand: input.brand === undefined ? current.brand : optional(input.brand),
    categoryId: requireCategory(repo, input.categoryId),
    unit: input.unit === undefined ? current.unit : resolveUnit(input.unit),
    priceCents:
      input.priceCents === undefined || input.priceCents === null
        ? current.priceCents
        : resolvePriceCents(input.priceCents),
    imageUrl: input.imageUrl === undefined ? current.imageUrl : optional(input.imageUrl),
    aisle: input.aisle === undefined ? current.aisle : optional(input.aisle),
  })
  return repo.products.adminGet(id)!
}

export function deleteProduct(repo: Repository, id: string): void {
  const current = repo.products.get(id)
  if (!current) throw new Error('Produto não encontrado.')
  const usage = repo.products.countUsage(id)
  if (usage > 0) {
    throw new Error(`Não é possível excluir: ${usage} registro(s) usam este produto.`)
  }
  repo.products.remove(id)
}

export function getOverview(repo: Repository): AdminOverview {
  return {
    counts: {
      users: repo.users.count({}),
      stores: repo.stores.adminList().length,
      products: repo.products.adminCount({}),
      categories: repo.categories.adminList().length,
      purchases: repo.purchases.adminCount(),
    },
    gmvCents: repo.purchases.adminSumTotal(),
    recentPurchases: repo.purchases.adminListRecent(8),
  }
}

export function listUsers(repo: Repository, filter: PageFilter = {}): ListResult<AdminUserRecord> {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20))
  const items = repo.users.list({
    search: filter.search,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })
  const total = repo.users.count({ search: filter.search })
  return { items, total, page, pageSize }
}

export function getUserDetail(repo: Repository, userId: string): AdminUserDetail {
  const user = repo.users.get(userId)
  if (!user) throw new Error('Usuário não encontrado.')
  return {
    user,
    lists: repo.lists.listByUser(userId),
    carts: repo.carts.listByUser(userId),
    purchases: repo.purchases.list(userId),
  }
}
