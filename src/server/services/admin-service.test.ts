import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type Database } from '../db/client'
import { createRepository, type Repository } from '../db/repositories'
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

  it('normaliza cidade vazia para null', () => {
    const store = createStore(repo, { name: 'Sem cidade', city: '   ' })
    expect(store.city).toBeNull()
  })

  it('atualiza loja existente', () => {
    updateStore(repo, 'store-1', { name: 'Mercado Novo', city: 'Santos' })
    expect(repo.stores.get('store-1')).toMatchObject({ name: 'Mercado Novo', city: 'Santos' })
  })

  it('rejeita atualização de loja inexistente', () => {
    expect(() => updateStore(repo, 'nao-existe', { name: 'X' })).toThrow('Loja não encontrada.')
  })

  it('preserva a cidade quando ela não é informada na atualização', () => {
    updateStore(repo, 'store-1', { name: 'Mercado Novo' })
    expect(repo.stores.get('store-1')).toMatchObject({ name: 'Mercado Novo', city: 'São Paulo' })
  })

  it('limpa a cidade quando null é informado na atualização', () => {
    updateStore(repo, 'store-1', { name: 'Mercado Novo', city: null })
    expect(repo.stores.get('store-1')?.city).toBeNull()
  })

  it('rejeita nome acima de 120 caracteres', () => {
    expect(() => createStore(repo, { name: 'a'.repeat(121) })).toThrow(
      'Nome da loja deve ter no máximo 120 caracteres.',
    )
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

  it('rejeita atualização de categoria inexistente', () => {
    expect(() => updateCategory(repo, 'nao-existe', { name: 'X' })).toThrow(
      'Categoria não encontrada.',
    )
  })

  it('rejeita exclusão de categoria inexistente', () => {
    expect(() => deleteCategory(repo, 'nao-existe')).toThrow('Categoria não encontrada.')
  })

  it('preserva ícone e cor quando não informados na atualização', () => {
    repo.categories.update('mercearia', { color: 'secondary' })
    updateCategory(repo, 'mercearia', { name: 'Mercearia Seca' })
    expect(repo.categories.get('mercearia')).toMatchObject({
      name: 'Mercearia Seca',
      icon: 'local_cafe',
      color: 'secondary',
    })
  })

  it('substitui ícone e cor quando informados na atualização', () => {
    updateCategory(repo, 'mercearia', {
      name: 'Mercearia Seca',
      icon: 'rice_bowl',
      color: 'secondary',
    })
    expect(repo.categories.get('mercearia')).toMatchObject({
      icon: 'rice_bowl',
      color: 'secondary',
    })
  })

  it('rejeita cor inválida na atualização', () => {
    expect(() => updateCategory(repo, 'mercearia', { name: 'X', color: 'rosa' })).toThrow(
      'Cor da categoria inválida.',
    )
  })

  it('bloqueia exclusão de categoria usada apenas por item de lista', () => {
    repo.lists.create({ userId: 'u1', name: 'Semana', shoppingDate: '2026-09-01' })
    const list = repo.lists.getActive('u1')!
    repo.lists.addItem(list.id, { name: 'Item avulso', categoryId: 'mercearia' })
    expect(() => deleteCategory(repo, 'mercearia')).toThrow(
      'Não é possível excluir: 1 registro(s) usam esta categoria.',
    )
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

describe('admin products', () => {
  it('cria produto com slug e gera código interno quando o barcode é vazio', () => {
    const product = createProduct(repo, {
      name: 'Café Torrado',
      categoryId: 'mercearia',
      priceCents: 1890,
      unit: 'un',
    })
    expect(product.id).toBe('cafe-torrado')
    expect(product.barcode.startsWith('INT-')).toBe(true)
    expect(product.categoryName).toBe('Mercearia')
  })

  it('aceita EAN-13 válido e rejeita inválido', () => {
    const valid = createProduct(repo, {
      name: 'Leite',
      barcode: '7891000244104',
      categoryId: 'mercearia',
    })
    expect(valid.barcode).toBe('7891000244104')

    expect(() =>
      createProduct(repo, { name: 'Refri', barcode: '7891000244109', categoryId: 'mercearia' }),
    ).toThrow('Código de barras EAN-13 inválido.')
  })

  it('rejeita barcode duplicado', () => {
    repo.products.insert({
      id: 'existente',
      barcode: '7891000244104',
      name: 'Existente',
      categoryId: 'mercearia',
    })
    expect(() =>
      createProduct(repo, {
        name: 'Outro',
        barcode: '7891000244104',
        categoryId: 'mercearia',
      }),
    ).toThrow('Já existe um produto com este código de barras.')
  })

  it('rejeita categoria inexistente, unidade e preço inválidos', () => {
    expect(() => createProduct(repo, { name: 'X', categoryId: 'nao-existe' })).toThrow(
      'Selecione uma categoria válida.',
    )
    expect(() =>
      createProduct(repo, { name: 'X', categoryId: 'mercearia', unit: 'caixa' }),
    ).toThrow('Unidade inválida.')
    expect(() =>
      createProduct(repo, { name: 'X', categoryId: 'mercearia', priceCents: -1 }),
    ).toThrow('Preço inválido.')
  })

  it('atualiza produto mantendo o barcode quando não informado', () => {
    const product = createProduct(repo, {
      name: 'Leite',
      barcode: '7891000244104',
      categoryId: 'mercearia',
    })
    const updated = updateProduct(repo, product.id, {
      name: 'Leite Integral',
      categoryId: 'mercearia',
      priceCents: 799,
    })
    expect(updated.name).toBe('Leite Integral')
    expect(updated.barcode).toBe('7891000244104')
    expect(updated.priceCents).toBe(799)
  })

  it('preserva campos opcionais omitidos na atualização', () => {
    const product = createProduct(repo, {
      name: 'Leite',
      categoryId: 'mercearia',
      brand: 'Nestlé',
      unit: 'L',
      priceCents: 799,
      aisle: 'Corredor 2',
    })
    const updated = updateProduct(repo, product.id, {
      name: 'Leite Integral',
      categoryId: 'mercearia',
    })
    expect(updated.brand).toBe('Nestlé')
    expect(updated.unit).toBe('L')
    expect(updated.priceCents).toBe(799)
    expect(updated.aisle).toBe('Corredor 2')
  })

  it('limpa campos de texto quando null é informado na atualização', () => {
    const product = createProduct(repo, {
      name: 'Leite',
      categoryId: 'mercearia',
      brand: 'Nestlé',
      imageUrl: 'https://exemplo.com/leite.png',
      aisle: 'Corredor 2',
    })
    const updated = updateProduct(repo, product.id, {
      name: 'Leite',
      categoryId: 'mercearia',
      brand: null,
      imageUrl: null,
      aisle: null,
    })
    expect(updated.brand).toBeNull()
    expect(updated.imageUrl).toBeNull()
    expect(updated.aisle).toBeNull()
  })

  it('preserva o código interno no round-trip de edição', () => {
    const product = createProduct(repo, { name: 'Granel', categoryId: 'mercearia' })
    expect(product.barcode.startsWith('INT-')).toBe(true)

    const updated = updateProduct(repo, product.id, {
      name: 'Granel Premium',
      barcode: product.barcode,
      categoryId: 'mercearia',
    })
    expect(updated.barcode).toBe(product.barcode)
  })

  it('rejeita atualização de produto inexistente', () => {
    expect(() => updateProduct(repo, 'nao-existe', { name: 'X', categoryId: 'mercearia' })).toThrow(
      'Produto não encontrado.',
    )
  })

  it('permite manter o próprio barcode e rejeita o de outro produto', () => {
    const product = createProduct(repo, {
      name: 'Café',
      barcode: '7891000244104',
      categoryId: 'mercearia',
    })
    createProduct(repo, { name: 'Leite', barcode: '7891000244111', categoryId: 'mercearia' })

    const same = updateProduct(repo, product.id, {
      name: 'Café Premium',
      barcode: '7891000244104',
      categoryId: 'mercearia',
    })
    expect(same.barcode).toBe('7891000244104')

    expect(() =>
      updateProduct(repo, product.id, {
        name: 'Café',
        barcode: '7891000244111',
        categoryId: 'mercearia',
      }),
    ).toThrow('Já existe um produto com este código de barras.')
  })

  it('bloqueia exclusão de produto em uso', () => {
    const product = createProduct(repo, { name: 'Café', categoryId: 'mercearia' })
    repo.lists.create({ userId: 'u1', name: 'Semana', shoppingDate: '2026-09-01' })
    const list = repo.lists.getActive('u1')!
    repo.lists.addItem(list.id, { productId: product.id, name: 'Café', categoryId: 'mercearia' })
    expect(() => deleteProduct(repo, product.id)).toThrow(
      'Não é possível excluir: 1 registro(s) usam este produto.',
    )
  })

  it('exclui produto sem uso', () => {
    const product = createProduct(repo, { name: 'Descartável', categoryId: 'mercearia' })
    deleteProduct(repo, product.id)
    expect(repo.products.get(product.id)).toBeNull()
  })

  it('lista produtos com filtro e paginação', () => {
    createProduct(repo, { name: 'Café', categoryId: 'mercearia' })
    createProduct(repo, { name: 'Leite', categoryId: 'mercearia' })
    const result = listProducts(repo, { search: 'le', page: 1, pageSize: 10 })
    expect(result.items.map((p) => p.name)).toEqual(['Leite'])
    expect(result.total).toBe(1)
    expect(result.categories.length).toBeGreaterThan(0)
  })

  it('normaliza paginação inválida para os limites padrão', () => {
    const result = listProducts(repo, { page: Number.NaN, pageSize: 2.5 })
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(2)

    const clamped = listProducts(repo, { page: -3, pageSize: 999 })
    expect(clamped.page).toBe(1)
    expect(clamped.pageSize).toBe(100)
  })
})

function ensureUserTable() {
  db.exec(
    `CREATE TABLE IF NOT EXISTS "user" (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       email TEXT NOT NULL UNIQUE,
       emailVerified INTEGER NOT NULL DEFAULT 0,
       image TEXT,
       createdAt TEXT NOT NULL DEFAULT (datetime('now')),
       updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  )
}

function seedUser(id: string, name: string, email: string) {
  ensureUserTable()
  db.prepare('INSERT INTO "user" (id, name, email) VALUES (?, ?, ?)').run(id, name, email)
}

describe('admin overview', () => {
  it('agrega contagens, GMV e compras recentes', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    createStore(repo, { name: 'Mercado A' })
    createCategory(repo, { name: 'Bebidas' })
    createProduct(repo, { name: 'Café', categoryId: 'mercearia' })
    for (let index = 1; index <= 9; index += 1) {
      repo.purchases.create({
        userId: 'u1',
        storeId: 'store-1',
        budgetCents: 10000,
        totalCents: 1000 * index,
        savingsCents: 0,
        itemCount: 1,
        purchasedAt: `2026-09-0${index}T10:00:00.000Z`,
      })
    }
    const overview = getOverview(repo)
    expect(overview.counts.users).toBe(1)
    expect(overview.counts.stores).toBe(2)
    expect(overview.counts.products).toBe(1)
    expect(overview.counts.categories).toBe(2)
    expect(overview.counts.purchases).toBe(9)
    expect(overview.gmvCents).toBe(45000)
    expect(overview.recentPurchases).toHaveLength(8)
    expect(overview.recentPurchases[0]?.totalCents).toBe(9000)
    expect(overview.recentPurchases[7]?.totalCents).toBe(2000)
    expect(overview.recentPurchases[0]?.userName).toBe('Ana')
  })
})

describe('admin users', () => {
  it('lista com paginação e busca', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    seedUser('u2', 'Bruno', 'bruno@x.dev')
    const page = listUsers(repo, { search: 'bru', page: 1, pageSize: 10 })
    expect(page.total).toBe(1)
    expect(page.items.map((u) => u.id)).toEqual(['u2'])
  })

  it('retorna detalhe com listas, carrinhos e compras do usuário', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    seedUser('u2', 'Bruno', 'bruno@x.dev')
    repo.lists.create({ userId: 'u1', name: 'Semana', shoppingDate: '2026-09-01' })
    repo.carts.getOrCreateActive({ userId: 'u1', storeId: 'store-1' })
    repo.purchases.create({
      userId: 'u1',
      storeId: 'store-1',
      budgetCents: 10000,
      totalCents: 4200,
      savingsCents: 0,
      itemCount: 1,
      purchasedAt: '2026-09-01T10:00:00.000Z',
    })
    repo.purchases.create({
      userId: 'u2',
      storeId: 'store-1',
      budgetCents: 10000,
      totalCents: 9900,
      savingsCents: 0,
      itemCount: 5,
      purchasedAt: '2026-09-02T10:00:00.000Z',
    })

    const detail = getUserDetail(repo, 'u1')
    expect(detail.user.email).toBe('ana@x.dev')
    expect(detail.lists).toHaveLength(1)
    expect(detail.carts).toHaveLength(1)
    expect(detail.purchases).toHaveLength(1)
    expect(detail.purchases[0]?.totalCents).toBe(4200)
  })

  it('falha para usuário inexistente', () => {
    ensureUserTable()
    expect(() => getUserDetail(repo, 'missing')).toThrow('Usuário não encontrado.')
  })
})
