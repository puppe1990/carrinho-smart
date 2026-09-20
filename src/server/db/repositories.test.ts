import { describe, expect, it, beforeEach } from 'vitest'
import { createDatabase, type Database } from './client'
import { createRepository, type Repository } from './repositories'

const USER = 'user-1'
const OTHER_USER = 'user-2'

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
  repo.categories.upsert({
    id: 'laticinios',
    name: 'Laticínios',
    icon: 'water_drop',
    color: 'secondary',
  })
  repo.stores.insert({ id: 'store-1', name: 'Pão de Açúcar - Morumbi', city: 'São Paulo' })
})

function seedProduct(overrides: Partial<Parameters<Repository['products']['insert']>[0]> = {}) {
  const product = {
    id: 'prod-1',
    barcode: '7891000244102',
    name: 'Café Torrado Especial 500g',
    brand: 'Pilão',
    categoryId: 'mercearia',
    unit: 'un' as const,
    priceCents: 1890,
    imageUrl: null,
    aisle: 'Corredor 3',
    ...overrides,
  }
  repo.products.insert(product)
  return product
}

describe('schema', () => {
  it('migrates twice without error', () => {
    expect(() => createDatabase(':memory:')).not.toThrow()
  })

  it('adds user scoping columns to personal tables', () => {
    for (const table of ['carts', 'shopping_lists', 'purchases', 'price_history']) {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
      expect(columns.map((column) => column.name)).toContain('user_id')
    }
  })
})

describe('product repository', () => {
  it('finds a product by barcode', () => {
    seedProduct()
    expect(repo.products.findByBarcode('7891000244102')?.name).toBe('Café Torrado Especial 500g')
  })

  it('returns null for unknown barcodes', () => {
    expect(repo.products.findByBarcode('000')).toBeNull()
  })

  it('searches by name or brand', () => {
    seedProduct()
    seedProduct({ id: 'prod-2', barcode: '2', name: 'Leite Integral', brand: 'Nestlé' })
    expect(repo.products.search('leite').map((p) => p.id)).toEqual(['prod-2'])
    expect(repo.products.search('pilão').map((p) => p.id)).toEqual(['prod-1'])
  })
})

describe('cart repository', () => {
  it('reuses the active cart for a store', () => {
    const first = repo.carts.getOrCreateActive({
      userId: USER,
      storeId: 'store-1',
      budgetCents: 35000,
    })
    const second = repo.carts.getOrCreateActive({
      userId: USER,
      storeId: 'store-1',
      budgetCents: 35000,
    })
    expect(second.id).toBe(first.id)
  })

  it('keeps carts isolated per user', () => {
    const mine = repo.carts.getOrCreateActive({
      userId: USER,
      storeId: 'store-1',
      budgetCents: 35000,
    })
    const theirs = repo.carts.getOrCreateActive({
      userId: OTHER_USER,
      storeId: 'store-1',
      budgetCents: 35000,
    })
    expect(theirs.id).not.toBe(mine.id)
    expect(repo.carts.get(mine.id, OTHER_USER)).toBeNull()
    expect(repo.carts.getActive(OTHER_USER, 'store-1')?.userId).toBe(OTHER_USER)
  })

  it('adds, updates and removes lines', () => {
    const cart = repo.carts.getOrCreateActive({
      userId: USER,
      storeId: 'store-1',
      budgetCents: 35000,
    })
    const line = repo.carts.addLine(cart.id, {
      name: 'Café',
      categoryId: 'mercearia',
      unitPriceCents: 1890,
      listPriceCents: 2090,
      quantity: 2,
      promo: true,
    })
    expect(repo.carts.listLines(cart.id)).toHaveLength(1)

    const updated = repo.carts.updateQuantity(line.id, 3)
    expect(updated.quantity).toBe(3)

    repo.carts.removeLine(line.id)
    expect(repo.carts.listLines(cart.id)).toHaveLength(0)
  })

  it('maps persisted lines into domain shape', () => {
    const cart = repo.carts.getOrCreateActive({
      userId: USER,
      storeId: 'store-1',
      budgetCents: 35000,
    })
    repo.carts.addLine(cart.id, {
      name: 'Banana',
      categoryId: 'hortifruti',
      unit: 'kg',
      unitPriceCents: 699,
      listPriceCents: 699,
      quantity: 1.45,
      isWeighed: true,
    })
    const [line] = repo.carts.listLines(cart.id)
    expect(line).toMatchObject({
      name: 'Banana',
      unit: 'kg',
      quantity: 1.45,
      promo: false,
      isWeighed: true,
      listItemId: null,
    })
  })

  it('summarises totals and savings consistently with the domain', () => {
    const cart = repo.carts.getOrCreateActive({
      userId: USER,
      storeId: 'store-1',
      budgetCents: 35000,
    })
    repo.carts.addLine(cart.id, {
      name: 'Café',
      categoryId: 'mercearia',
      unitPriceCents: 1890,
      listPriceCents: 2090,
      quantity: 2,
      promo: true,
    })
    const summary = repo.carts.summary(cart.id)
    expect(summary).toEqual({ kindCount: 1, unitCount: 2, totalCents: 3780, savingsCents: 400 })
  })

  it('updates the budget and clears the cart', () => {
    const cart = repo.carts.getOrCreateActive({
      userId: USER,
      storeId: 'store-1',
      budgetCents: 35000,
    })
    repo.carts.addLine(cart.id, {
      name: 'Café',
      categoryId: 'mercearia',
      unitPriceCents: 1890,
      listPriceCents: 1890,
      quantity: 1,
    })
    repo.carts.updateBudget(cart.id, USER, 40000)
    expect(repo.carts.get(cart.id, USER)?.budgetCents).toBe(40000)

    repo.carts.clear(cart.id)
    expect(repo.carts.listLines(cart.id)).toHaveLength(0)
  })

  it('checks out into a purchase and records price history', () => {
    seedProduct()
    const cart = repo.carts.getOrCreateActive({
      userId: USER,
      storeId: 'store-1',
      budgetCents: 35000,
    })
    repo.carts.addLine(cart.id, {
      productId: 'prod-1',
      name: 'Café Torrado Especial 500g',
      categoryId: 'mercearia',
      unitPriceCents: 1890,
      listPriceCents: 2090,
      quantity: 2,
      promo: true,
    })

    const purchase = repo.carts.checkout(cart.id)
    expect(purchase.totalCents).toBe(3780)
    expect(purchase.savingsCents).toBe(400)
    expect(purchase.itemCount).toBe(1)

    expect(repo.carts.get(cart.id, USER)?.status).toBe('checked_out')
    expect(repo.carts.listLines(cart.id)).toHaveLength(0)
    expect(repo.purchases.getItems(purchase.id)).toHaveLength(1)
    expect(repo.priceHistory.lastForProduct(USER, 'prod-1')?.priceCents).toBe(1890)

    const fresh = repo.carts.getOrCreateActive({
      userId: USER,
      storeId: 'store-1',
      budgetCents: 35000,
    })
    expect(fresh.id).not.toBe(cart.id)
  })
})

describe('shopping list repository', () => {
  it('creates a list with items and tracks progress', () => {
    seedProduct()
    const list = repo.lists.create({
      userId: USER,
      name: 'Compras do Mês',
      shoppingDate: '2024-05-24',
      budgetCents: 35000,
    })
    const pending = repo.lists.addItem(list.id, {
      name: 'Azeite de Oliva',
      categoryId: 'mercearia',
      aisle: 'Corredor 4',
      expectedPriceCents: 4000,
    })
    const toScan = repo.lists.addItem(list.id, {
      name: 'Café',
      categoryId: 'mercearia',
      productId: 'prod-1',
      expectedPriceCents: 2090,
      quantity: 2,
    })

    repo.lists.setStatus(toScan.id, 'scanned', 1890)

    const progress = repo.lists.progress(list.id)
    expect(progress.total).toBe(2)
    expect(progress.scannedCount).toBe(1)
    expect(progress.pendingCount).toBe(1)
    expect(progress.percentScanned).toBe(50)
    expect(progress.expectedTotalCents).toBe(6090)
    expect(progress.scannedTotalCents).toBe(1890)

    const items = repo.lists.listItems(list.id)
    expect(items.find((i) => i.id === pending.id)?.status).toBe('pending')
  })

  it('keeps the active list isolated per user', () => {
    repo.lists.create({ userId: USER, name: 'Minha lista', shoppingDate: '2024-05-24' })
    repo.lists.create({ userId: OTHER_USER, name: 'Lista do outro', shoppingDate: '2024-05-24' })
    expect(repo.lists.getActive(USER)?.name).toBe('Minha lista')
    expect(repo.lists.getActive(OTHER_USER)?.name).toBe('Lista do outro')
  })

  it('removes items', () => {
    const list = repo.lists.create({
      userId: USER,
      name: 'Lista',
      shoppingDate: '2024-05-24',
      budgetCents: 0,
    })
    const item = repo.lists.addItem(list.id, { name: 'Arroz' })
    repo.lists.removeItem(item.id)
    expect(repo.lists.listItems(list.id)).toHaveLength(0)
  })
})

describe('purchase repository', () => {
  it('filters purchases by user and month and exposes items', () => {
    repo.purchases.create(
      {
        id: 'pur-1',
        userId: USER,
        storeId: 'store-1',
        budgetCents: 35000,
        totalCents: 31470,
        savingsCents: 4120,
        itemCount: 2,
        purchasedAt: '2024-05-24T11:42:00.000Z',
      },
      [
        {
          name: 'Café',
          categoryId: 'mercearia',
          unitPriceCents: 1890,
          quantity: 2,
          totalCents: 3780,
          wasPromo: true,
        },
      ],
    )
    repo.purchases.create({
      id: 'pur-2',
      userId: OTHER_USER,
      storeId: 'store-1',
      budgetCents: 35000,
      totalCents: 10000,
      savingsCents: 0,
      itemCount: 1,
      purchasedAt: '2024-06-02T10:00:00.000Z',
    })

    const may = repo.purchases.listForMonth(USER, 2024, 5)
    expect(may.map((p) => p.id)).toEqual(['pur-1'])
    expect(may[0].storeName).toBe('Pão de Açúcar - Morumbi')
    expect(repo.purchases.getItems('pur-1')[0].name).toBe('Café')

    expect(repo.purchases.list(OTHER_USER).map((p) => p.id)).toEqual(['pur-2'])
    expect(repo.purchases.get('pur-1', OTHER_USER)).toBeNull()
  })
})

describe('price history repository', () => {
  it('keeps price history isolated per user and returns the most recent first', () => {
    seedProduct()
    repo.priceHistory.record({
      userId: USER,
      productId: 'prod-1',
      storeId: 'store-1',
      priceCents: 3650,
      recordedAt: '2024-05-01T10:00:00.000Z',
    })
    repo.priceHistory.record({
      userId: USER,
      productId: 'prod-1',
      storeId: 'store-1',
      priceCents: 3890,
      recordedAt: '2024-05-24T10:00:00.000Z',
    })
    expect(repo.priceHistory.lastForProduct(USER, 'prod-1')?.priceCents).toBe(3890)
    expect(repo.priceHistory.historyForProduct(USER, 'prod-1')).toHaveLength(2)
    expect(repo.priceHistory.lastForProduct(OTHER_USER, 'prod-1')).toBeNull()
  })
})
