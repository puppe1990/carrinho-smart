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
  listCategories,
  listProducts,
  listStores,
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

  it('rejeita atualização de produto inexistente', () => {
    expect(() => updateProduct(repo, 'nao-existe', { name: 'X', categoryId: 'mercearia' })).toThrow(
      'Produto não encontrado.',
    )
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
})
