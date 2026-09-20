import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type Database } from '../db/client'
import { createRepository, type Repository } from '../db/repositories'
import {
  createCategory,
  createStore,
  deleteCategory,
  deleteStore,
  listCategories,
  listStores,
  updateCategory,
  updateStore,
} from './admin-service'

let db: Database
let repo: Repository

beforeEach(() => {
  db = createDatabase(':memory:')
  repo = createRepository(db)
  repo.categories.upsert({
    id: 'mercearia',
    name: 'Mercearia',
    icon: 'local_cafe',
    color: 'primary',
  })
  repo.stores.insert({ id: 'store-1', name: 'Pão de Açúcar', city: 'São Paulo' })
})

describe('admin stores', () => {
  it('cria loja com id de slug', () => {
    const store = createStore(repo, { name: 'Pão de Açúcar', city: 'Campinas' })
    expect(store.id).toBe('pao-de-acucar')
    expect(store.name).toBe('Pão de Açúcar')
    expect(store.usageCount).toBe(0)
  })

  it('gera id único quando o slug colide', () => {
    const first = createStore(repo, { name: 'Extra' })
    const second = createStore(repo, { name: 'Extra' })
    expect(first.id).toBe('extra')
    expect(second.id).toBe('extra-2')
  })

  it('rejeita nome vazio', () => {
    expect(() => createStore(repo, { name: '   ' })).toThrow('Nome da loja é obrigatório.')
  })

  it('atualiza loja existente', () => {
    updateStore(repo, 'store-1', { name: 'Mercado Novo', city: 'Santos' })
    expect(repo.stores.get('store-1')).toMatchObject({ name: 'Mercado Novo', city: 'Santos' })
  })

  it('bloqueia exclusão de loja em uso', () => {
    repo.carts.getOrCreateActive({ userId: 'u1', storeId: 'store-1' })
    expect(() => deleteStore(repo, 'store-1')).toThrow(
      'Não é possível excluir: 1 registro(s) usam esta loja.',
    )
  })

  it('exclui loja sem uso', () => {
    const store = createStore(repo, { name: 'Sem uso' })
    deleteStore(repo, store.id)
    expect(repo.stores.get(store.id)).toBeNull()
  })

  it('lista lojas com contagem de uso', () => {
    expect(listStores(repo).map((s) => s.id)).toContain('store-1')
  })
})

describe('admin categories', () => {
  it('cria categoria com slug e cor padrão', () => {
    const category = createCategory(repo, { name: 'Bebidas' })
    expect(category.id).toBe('bebidas')
    expect(category.color).toBe('primary')
    expect(category.icon).toBe('category')
  })

  it('rejeita cor inválida', () => {
    expect(() => createCategory(repo, { name: 'Bebidas', color: 'rosa' })).toThrow(
      'Cor da categoria inválida.',
    )
  })

  it('atualiza categoria', () => {
    updateCategory(repo, 'mercearia', { name: 'Mercearia Seca', icon: 'rice_bowl' })
    expect(repo.categories.get('mercearia')).toMatchObject({
      name: 'Mercearia Seca',
      icon: 'rice_bowl',
    })
  })

  it('bloqueia exclusão de categoria com produtos', () => {
    repo.products.insert({
      id: 'p1',
      barcode: '7891000244102',
      name: 'Café',
      categoryId: 'mercearia',
      priceCents: 1000,
    })
    expect(() => deleteCategory(repo, 'mercearia')).toThrow(
      'Não é possível excluir: 1 registro(s) usam esta categoria.',
    )
  })

  it('exclui categoria sem produtos', () => {
    deleteCategory(repo, 'mercearia')
    expect(repo.categories.get('mercearia')).toBeNull()
  })

  it('lista categorias com contagem de referências', () => {
    expect(listCategories(repo).map((c) => c.referenceCount)).toContain(0)
  })
})
