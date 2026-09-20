import type { AdminCategoryRecord, AdminStoreRecord } from '../db/models'
import type { Repository } from '../db/repositories'
import { uniqueSlug } from '../db/slug'

const COLORS = ['primary', 'secondary', 'tertiary', 'outline']
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
