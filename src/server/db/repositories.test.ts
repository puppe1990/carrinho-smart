import { describe, expect, it, beforeEach } from 'vitest'
import { createDatabase, type Database } from './client'
import { createRepository, type Repository } from './repositories'
import { migrate } from './schema'

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

  it('upgrades synthetic catalog barcodes to real EANs idempotently', () => {
    repo.products.insert({
      id: 'prod-1',
      barcode: '7891000000015',
      name: 'Café',
      categoryId: 'mercearia',
    })
    migrate(db)
    const upgraded = repo.products.get('prod-1')
    expect(upgraded?.barcode).toBe('7896089011982')
    expect(upgraded?.brand).toBe('Pilão')

    migrate(db)
    expect(repo.products.get('prod-1')?.barcode).toBe('7896089011982')
  })

  it('removes synthetic catalog products but keeps edited ones', () => {
    repo.products.insert({
      id: 'prod-14',
      barcode: '7891000000144',
      name: 'Banana',
      categoryId: 'mercearia',
    })
    repo.products.insert({
      id: 'prod-15',
      barcode: '7891234567895',
      name: 'Editado',
      categoryId: 'mercearia',
    })
    repo.lists.create({ userId: USER, name: 'Semana', shoppingDate: '2026-09-01' })
    const list = repo.lists.getActive(USER)!
    const item = repo.lists.addItem(list.id, {
      productId: 'prod-14',
      name: 'Banana',
      categoryId: 'mercearia',
    })

    migrate(db)

    expect(repo.products.get('prod-14')).toBeNull()
    expect(repo.products.get('prod-15')).not.toBeNull()
    expect(repo.lists.getItem(item.id)?.productId).toBeNull()
  })

  it('insere produtos extras do catálogo quando a categoria existe', () => {
    migrate(db)
    const coca = repo.products.findByBarcode('7894900701517')
    expect(coca?.name).toBe('Coca-Cola Zero 2L')
    expect(coca?.unit).toBe('un')

    migrate(db)
    expect(repo.products.adminList({ search: 'coca-cola zero' })).toHaveLength(1)
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

describe('category repository (admin)', () => {
  it('cria, atualiza e remove categorias', () => {
    repo.categories.insert({
      id: 'bebidas',
      name: 'Bebidas',
      icon: 'local_drink',
      color: 'primary',
    })
    expect(repo.categories.adminGet('bebidas')?.name).toBe('Bebidas')

    repo.categories.update('bebidas', { name: 'Bebidas e Sucos' })
    expect(repo.categories.get('bebidas')?.name).toBe('Bebidas e Sucos')

    repo.categories.remove('bebidas')
    expect(repo.categories.get('bebidas')).toBeNull()
  })

  it('conta produtos por categoria', () => {
    seedProduct()
    expect(repo.categories.adminGet('mercearia')?.productCount).toBe(1)
    expect(repo.categories.adminGet('laticinios')?.productCount).toBe(0)
  })

  it('conta referências somando produtos e itens de lista', () => {
    seedProduct()
    expect(repo.categories.adminGet('mercearia')?.referenceCount).toBe(1)

    repo.lists.create({ userId: USER, name: 'Semana', shoppingDate: '2026-09-01' })
    const list = repo.lists.getActive(USER)!
    repo.lists.addItem(list.id, { name: 'Café avulso', categoryId: 'mercearia' })
    expect(repo.categories.adminGet('mercearia')?.productCount).toBe(1)
    expect(repo.categories.adminGet('mercearia')?.referenceCount).toBe(2)
    expect(repo.categories.countReferences('mercearia')).toBe(2)

    repo.lists.addItem(list.id, { name: 'Item avulso', categoryId: 'laticinios' })
    expect(repo.categories.adminGet('laticinios')?.productCount).toBe(0)
    expect(repo.categories.adminGet('laticinios')?.referenceCount).toBe(1)
  })
})

describe('store repository (admin)', () => {
  it('atualiza nome e cidade', () => {
    repo.stores.update('store-1', { name: 'Mercado Novo', city: 'Campinas' })
    expect(repo.stores.get('store-1')).toEqual({
      id: 'store-1',
      name: 'Mercado Novo',
      city: 'Campinas',
    })
  })

  it('preserva a cidade quando ela é omitida', () => {
    repo.stores.update('store-1', { name: 'Mercado Novo' })
    expect(repo.stores.get('store-1')?.city).toBe('São Paulo')
  })

  it('limpa a cidade quando null é informado', () => {
    repo.stores.update('store-1', { city: null })
    expect(repo.stores.get('store-1')?.city).toBeNull()
  })

  it('conta uso em carrinhos, compras e histórico', () => {
    seedProduct()
    const cart = repo.carts.getOrCreateActive({
      userId: USER,
      storeId: 'store-1',
      budgetCents: 1000,
    })
    repo.carts.addLine(cart.id, {
      productId: 'prod-1',
      name: 'Café',
      categoryId: 'mercearia',
      unitPriceCents: 1000,
    })
    repo.carts.checkout(cart.id)
    expect(repo.stores.countUsage('store-1')).toBe(3)
    expect(repo.stores.adminGet('store-1')?.usageCount).toBe(3)
  })

  it('remove lojas sem uso', () => {
    repo.stores.insert({ id: 'store-2', name: 'Sem uso', city: null })
    repo.stores.remove('store-2')
    expect(repo.stores.get('store-2')).toBeNull()
  })
})

describe('product repository (admin)', () => {
  it('atualiza campos do produto', () => {
    seedProduct()
    repo.products.update('prod-1', { name: 'Café Premium', priceCents: 2590 })
    expect(repo.products.get('prod-1')?.name).toBe('Café Premium')
    expect(repo.products.get('prod-1')?.priceCents).toBe(2590)
  })

  it('conta uso do produto em carrinho, lista, compra e histórico', () => {
    seedProduct()

    repo.lists.create({ userId: USER, name: 'Semana', shoppingDate: '2026-09-01' })
    const list = repo.lists.getActive(USER)!
    repo.lists.addItem(list.id, { productId: 'prod-1', name: 'Café', categoryId: 'mercearia' })

    const cart = repo.carts.getOrCreateActive({ userId: USER, storeId: 'store-1' })
    repo.carts.addLine(cart.id, {
      productId: 'prod-1',
      name: 'Café',
      categoryId: 'mercearia',
      unitPriceCents: 1000,
    })

    repo.purchases.create(
      {
        userId: USER,
        storeId: 'store-1',
        budgetCents: 1000,
        totalCents: 1000,
        savingsCents: 0,
        itemCount: 1,
        purchasedAt: '2026-09-01T10:00:00.000Z',
      },
      [
        {
          productId: 'prod-1',
          name: 'Café',
          categoryId: 'mercearia',
          unitPriceCents: 1000,
          quantity: 1,
          totalCents: 1000,
          wasPromo: false,
        },
      ],
    )

    repo.priceHistory.record({
      userId: USER,
      productId: 'prod-1',
      storeId: 'store-1',
      priceCents: 1000,
    })

    expect(repo.products.countUsage('prod-1')).toBe(4)
    expect(repo.products.adminGet('prod-1')?.usageCount).toBe(4)
  })

  it('lista e filtra produtos com nome da categoria', () => {
    seedProduct()
    seedProduct({ id: 'prod-2', barcode: '7891000244103', name: 'Leite', brand: 'Nestlé' })
    const all = repo.products.adminList({})
    expect(all).toHaveLength(2)
    expect(all[0]?.categoryName).toBeTruthy()
    expect(repo.products.adminList({ search: 'leite' }).map((p) => p.id)).toEqual(['prod-2'])
    expect(repo.products.adminList({ categoryId: 'laticinios' })).toHaveLength(0)
    expect(repo.products.adminCount({ search: 'leite' })).toBe(1)
  })

  it('remove produto sem uso', () => {
    seedProduct()
    repo.products.remove('prod-1')
    expect(repo.products.get('prod-1')).toBeNull()
  })
})

function seedUser(id: string, name: string, email: string) {
  db.prepare('INSERT INTO "user" (id, name, email) VALUES (?, ?, ?)').run(id, name, email)
}

describe('user repository (admin)', () => {
  it('lista usuários com contagens e total gasto isolados por usuário', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    seedUser('u2', 'Bruno', 'bruno@x.dev')
    repo.lists.create({ userId: 'u1', name: 'Semana', shoppingDate: '2026-09-01' })
    repo.carts.getOrCreateActive({ userId: 'u1', storeId: 'store-1' })
    repo.purchases.create({
      userId: 'u1',
      storeId: 'store-1',
      budgetCents: 10000,
      totalCents: 5000,
      savingsCents: 0,
      itemCount: 2,
      purchasedAt: '2026-09-01T10:00:00.000Z',
    })
    repo.purchases.create({
      userId: 'u2',
      storeId: 'store-1',
      budgetCents: 10000,
      totalCents: 9000,
      savingsCents: 0,
      itemCount: 3,
      purchasedAt: '2026-09-02T10:00:00.000Z',
    })

    expect(repo.users.list({})).toHaveLength(2)
    expect(repo.users.get('u1')).toMatchObject({
      id: 'u1',
      email: 'ana@x.dev',
      listCount: 1,
      cartCount: 1,
      purchaseCount: 1,
      totalSpentCents: 5000,
    })
    expect(repo.users.get('u2')?.totalSpentCents).toBe(9000)
    expect(repo.users.get('u2')?.listCount).toBe(0)
    expect(repo.users.get('u2')?.cartCount).toBe(0)
    expect(repo.users.count({ search: 'ana' })).toBe(1)
  })

  it('busca e obtém usuário por id', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    seedUser('u2', 'Bruno', 'bruno@x.dev')
    expect(repo.users.list({ search: 'bruno' }).map((u) => u.id)).toEqual(['u2'])
    expect(repo.users.get('u1')?.name).toBe('Ana')
    expect(repo.users.get('missing')).toBeNull()
  })

  it('pagina de forma estável quando createdAt empata', () => {
    for (const id of ['u1', 'u2', 'u3']) {
      db.prepare('INSERT INTO "user" (id, name, email, createdAt) VALUES (?, ?, ?, ?)').run(
        id,
        id,
        `${id}@x.dev`,
        '2026-09-01T10:00:00.000Z',
      )
    }
    const first = repo.users.list({ limit: 2, offset: 0 }).map((u) => u.id)
    const second = repo.users.list({ limit: 2, offset: 2 }).map((u) => u.id)
    expect(first).toEqual(['u3', 'u2'])
    expect(second).toEqual(['u1'])
  })
})

describe('purchases repository (admin)', () => {
  it('soma total, conta e lista recentes com nome da loja e usuário', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    repo.purchases.create({
      userId: 'u1',
      storeId: 'store-1',
      budgetCents: 10000,
      totalCents: 5000,
      savingsCents: 0,
      itemCount: 2,
      purchasedAt: '2026-09-01T10:00:00.000Z',
    })
    expect(repo.purchases.adminCount()).toBe(1)
    expect(repo.purchases.adminSumTotal()).toBe(5000)
    const [recent] = repo.purchases.adminListRecent(5)
    expect(recent?.storeName).toBe('Pão de Açúcar - Morumbi')
    expect(recent?.userName).toBe('Ana')
  })
})

describe('lists and carts by user', () => {
  it('lista listas e carrinhos de um usuário', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    repo.lists.create({ userId: 'u1', name: 'Semana', shoppingDate: '2026-09-01' })
    repo.carts.getOrCreateActive({ userId: 'u1', storeId: 'store-1' })
    expect(repo.lists.listByUser('u1')).toHaveLength(1)
    expect(repo.carts.listByUser('u1')).toHaveLength(1)
  })
})
