import { faker } from '@faker-js/faker'
import { CATALOG_EXTRA_PRODUCTS, CATALOG_REAL_PRODUCTS } from './catalog-barcodes'
import type { Database } from './client'
import { createRepository, type Repository } from './repositories'

export const DEMO_USER_ID = 'user-demo'
export const DEMO_USER = {
  id: DEMO_USER_ID,
  name: 'Família Demo',
  email: 'demo@carrinhosmart.dev',
  password: 'demo12345',
}

export interface SeedOptions {
  seed?: number
  now?: Date
  userId?: string
}

export interface SeedResult {
  categoryCount: number
  storeCount: number
  productCount: number
  listItemCount: number
  cartLineCount: number
  purchaseCount: number
  userId: string
}

const TABLES_IN_DELETE_ORDER = [
  'purchase_items',
  'price_history',
  'cart_items',
  'purchases',
  'carts',
  'list_items',
  'shopping_lists',
  'products',
  'stores',
  'categories',
] as const

export function resetDatabase(db: Database): void {
  db.pragma('foreign_keys = OFF')
  const run = db.transaction(() => {
    for (const table of TABLES_IN_DELETE_ORDER) {
      db.prepare(`DELETE FROM ${table}`).run()
    }
  })
  run()
  db.pragma('foreign_keys = ON')
}

export function clearUserData(db: Database, userId: string): void {
  const run = db.transaction(() => {
    db.prepare(
      'DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE user_id = ?)',
    ).run(userId)
    db.prepare('DELETE FROM price_history WHERE user_id = ?').run(userId)
    db.prepare(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
    ).run(userId)
    db.prepare('DELETE FROM purchases WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM carts WHERE user_id = ?').run(userId)
    db.prepare(
      'DELETE FROM list_items WHERE list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)',
    ).run(userId)
    db.prepare('DELETE FROM shopping_lists WHERE user_id = ?').run(userId)
  })
  run()
}

const CATEGORIES = [
  { id: 'mercearia', name: 'Mercearia', icon: 'local_cafe', color: 'primary' },
  { id: 'laticinios', name: 'Laticínios', icon: 'water_drop', color: 'secondary' },
  { id: 'hortifruti', name: 'Hortifrúti', icon: 'nutrition', color: 'tertiary' },
  { id: 'limpeza', name: 'Limpeza', icon: 'cleaning_services', color: 'outline' },
  { id: 'higiene', name: 'Higiene', icon: 'soap', color: 'tertiary' },
  { id: 'padaria', name: 'Padaria', icon: 'bakery_dining', color: 'secondary' },
] as const

const AISLES: Record<string, string> = {
  mercearia: 'Corredor 3 (Mercearia)',
  laticinios: 'Corredor 6 (Frios)',
  hortifruti: 'Hortifrúti',
  limpeza: 'Corredor 9 (Limpeza)',
  higiene: 'Corredor 8 (Higiene)',
  padaria: 'Padaria',
}

interface ProductTemplate {
  name: string
  categoryId: string
  unit: 'un' | 'kg' | 'L'
  basePriceCents: number
}

const PRODUCT_TEMPLATES: ProductTemplate[] = [
  { name: 'Café Torrado Especial 500g', categoryId: 'mercearia', unit: 'un', basePriceCents: 1890 },
  { name: 'Arroz Branco Tipo 1 5kg', categoryId: 'mercearia', unit: 'un', basePriceCents: 2790 },
  { name: 'Feijão Carioca 1kg', categoryId: 'mercearia', unit: 'un', basePriceCents: 890 },
  { name: 'Açúcar Refinado 1kg', categoryId: 'mercearia', unit: 'un', basePriceCents: 549 },
  { name: 'Óleo de Soja 900ml', categoryId: 'mercearia', unit: 'un', basePriceCents: 749 },
  {
    name: 'Azeite de Oliva Extra Virgem 500ml',
    categoryId: 'mercearia',
    unit: 'un',
    basePriceCents: 4190,
  },
  { name: 'Macarrão Espaguete 500g', categoryId: 'mercearia', unit: 'un', basePriceCents: 459 },
  { name: 'Molho de Tomate 340g', categoryId: 'mercearia', unit: 'un', basePriceCents: 329 },
  { name: 'Leite Integral Orgânico 1L', categoryId: 'laticinios', unit: 'un', basePriceCents: 549 },
  {
    name: 'Queijo Mussarela Fatiado 400g',
    categoryId: 'laticinios',
    unit: 'un',
    basePriceCents: 2250,
  },
  { name: 'Iogurte Natural 170g', categoryId: 'laticinios', unit: 'un', basePriceCents: 400 },
  { name: 'Manteiga com Sal 200g', categoryId: 'laticinios', unit: 'un', basePriceCents: 1290 },
  { name: 'Requeijão Cremoso 200g', categoryId: 'laticinios', unit: 'un', basePriceCents: 890 },
  { name: 'Banana Prata', categoryId: 'hortifruti', unit: 'kg', basePriceCents: 699 },
  { name: 'Tomate Italiano', categoryId: 'hortifruti', unit: 'kg', basePriceCents: 850 },
  { name: 'Maçã Fuji', categoryId: 'hortifruti', unit: 'kg', basePriceCents: 1090 },
  { name: 'Alface Crespa', categoryId: 'hortifruti', unit: 'un', basePriceCents: 399 },
  { name: 'Cenoura', categoryId: 'hortifruti', unit: 'kg', basePriceCents: 549 },
  { name: 'Batata Inglesa', categoryId: 'hortifruti', unit: 'kg', basePriceCents: 599 },
  {
    name: 'Detergente Lava-Louças Maçã 500ml',
    categoryId: 'limpeza',
    unit: 'un',
    basePriceCents: 289,
  },
  { name: 'Sabão Líquido Concentrado 3L', categoryId: 'limpeza', unit: 'un', basePriceCents: 3890 },
  { name: 'Desinfetante Lavanda 1L', categoryId: 'limpeza', unit: 'un', basePriceCents: 799 },
  { name: 'Papel Toalha 2 rolos', categoryId: 'limpeza', unit: 'un', basePriceCents: 690 },
  { name: 'Papel Higiênico 12 rolos', categoryId: 'higiene', unit: 'un', basePriceCents: 2400 },
  { name: 'Creme Dental 90g', categoryId: 'higiene', unit: 'un', basePriceCents: 590 },
  { name: 'Sabonete Glicerinado 90g', categoryId: 'higiene', unit: 'un', basePriceCents: 349 },
  { name: 'Shampoo Nutrição 350ml', categoryId: 'higiene', unit: 'un', basePriceCents: 1790 },
  { name: 'Pão de Forma Integral', categoryId: 'padaria', unit: 'un', basePriceCents: 1190 },
  { name: 'Pão Francês', categoryId: 'padaria', unit: 'kg', basePriceCents: 1490 },
]

const STORES = [
  { id: 'store-pao-de-acucar', name: 'Pão de Açúcar - Morumbi', city: 'São Paulo' },
  { id: 'store-carrefour', name: 'Carrefour - Vila Olímpia', city: 'São Paulo' },
  { id: 'store-atacadao', name: 'Atacadão - Aricanduva', city: 'São Paulo' },
  { id: 'store-extra', name: 'Extra - Pinheiros', city: 'São Paulo' },
]

function hashSeed(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647
  }
  return hash || 1
}

function randomVariance(basePriceCents: number): number {
  const delta = faker.number.int({ min: -80, max: 160 })
  return Math.max(99, basePriceCents + delta)
}

export function seedCatalog(repo: Repository, options: { seed?: number } = {}): void {
  faker.seed(options.seed ?? 42)

  for (const category of CATEGORIES) repo.categories.upsert(category)
  for (const store of STORES) repo.stores.insert(store)

  PRODUCT_TEMPLATES.forEach((template, index) => {
    const id = `prod-${index + 1}`
    const real = CATALOG_REAL_PRODUCTS[id]
    if (!real) return
    repo.products.insert({
      id,
      barcode: real.barcode,
      name: template.name,
      brand: real.brand,
      categoryId: template.categoryId,
      unit: template.unit,
      priceCents: randomVariance(template.basePriceCents),
      aisle: AISLES[template.categoryId],
      imageUrl: null,
    })
  })

  for (const product of CATALOG_EXTRA_PRODUCTS) {
    repo.products.insert({
      id: product.id,
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      unit: product.unit,
      priceCents: product.priceCents,
      aisle: product.aisle,
      imageUrl: null,
    })
  }
}

export function seedUserData(
  db: Database,
  repo: Repository,
  userId: string,
  options: { seed?: number; now?: Date } = {},
): void {
  clearUserData(db, userId)
  faker.seed(options.seed ?? hashSeed(userId))

  const now = options.now ?? new Date()
  const products = repo.products.list()
  if (products.length === 0) throw new Error('Catálogo vazio: rode o seed do catálogo primeiro.')

  const activeList = repo.lists.create({
    id: `list-${userId}`,
    userId,
    name: 'Compras do Mês - Família',
    shoppingDate: now.toISOString().slice(0, 10),
    budgetCents: 35000,
  })

  const plannedProducts = faker.helpers.arrayElements(products, 12)
  const listItems = repo.lists.addItems(
    activeList.id,
    plannedProducts.map((product) => ({
      productId: product.id,
      name: product.name,
      categoryId: product.categoryId,
      aisle: product.aisle,
      expectedPriceCents: product.priceCents,
      quantity:
        product.unit === 'kg'
          ? faker.number.float({ min: 0.4, max: 1.8, fractionDigits: 3 })
          : faker.number.int({ min: 1, max: 3 }),
    })),
  )
  repo.lists.addItems(activeList.id, [
    {
      name: 'Chocolate Amargo 70%',
      categoryId: 'mercearia',
      aisle: 'Corredor 3 (Mercearia)',
      expectedPriceCents: 990,
    },
    { name: 'Flores para a casa', categoryId: null, aisle: null, expectedPriceCents: 2500 },
  ])

  const scannedSelection = faker.helpers.arrayElements(listItems, 8)
  for (const item of scannedSelection) {
    repo.lists.setStatus(
      item.id,
      'scanned',
      Math.max(99, item.expectedPriceCents - faker.number.int({ min: 0, max: 250 })),
    )
  }

  const cart = repo.carts.getOrCreateActive({
    userId,
    storeId: 'store-pao-de-acucar',
    listId: activeList.id,
    budgetCents: 35000,
  })

  const cartProducts = faker.helpers.arrayElements(products, 6)
  cartProducts.forEach((product, index) => {
    const isPromo = index % 3 === 0
    const unitPriceCents = product.priceCents
    repo.carts.addLine(cart.id, {
      productId: product.id,
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      unit: product.unit,
      unitPriceCents,
      listPriceCents: isPromo ? Math.round(unitPriceCents * 1.12) : unitPriceCents,
      quantity: product.unit === 'kg' ? 1.45 : faker.number.int({ min: 1, max: 3 }),
      promo: isPromo,
      isWeighed: product.unit === 'kg',
    })
  })

  for (let monthOffset = 3; monthOffset >= 1; monthOffset -= 1) {
    const purchasesThisMonth = faker.number.int({ min: 1, max: 3 })
    for (let index = 0; index < purchasesThisMonth; index += 1) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - monthOffset,
        faker.number.int({ min: 2, max: 26 }),
        faker.number.int({ min: 9, max: 20 }),
        faker.number.int({ min: 0, max: 59 }),
      )
      const store = faker.helpers.arrayElement(STORES)
      const chosen = faker.helpers.arrayElements(products, faker.number.int({ min: 5, max: 11 }))

      let totalCents = 0
      let savingsCents = 0
      const items = chosen.map((product) => {
        const quantity =
          product.unit === 'kg'
            ? faker.number.float({ min: 0.3, max: 2, fractionDigits: 3 })
            : faker.number.int({ min: 1, max: 3 })
        const promo = faker.datatype.boolean({ probability: 0.25 })
        const unitPriceCents = product.priceCents
        const listPrice = promo ? Math.round(unitPriceCents * 1.15) : unitPriceCents
        const lineTotal = Math.round(unitPriceCents * quantity)
        totalCents += lineTotal
        savingsCents += promo ? Math.round((listPrice - unitPriceCents) * quantity) : 0
        return {
          productId: product.id,
          name: product.name,
          categoryId: product.categoryId,
          unitPriceCents,
          quantity,
          totalCents: lineTotal,
          wasPromo: promo,
        }
      })

      repo.purchases.create(
        {
          userId,
          storeId: store.id,
          listId: null,
          budgetCents: 35000,
          totalCents,
          savingsCents,
          itemCount: items.length,
          purchasedAt: date.toISOString(),
        },
        items,
      )
    }
  }
}

export function ensureUserData(
  db: Database,
  repo: Repository,
  userId: string,
  options: { seed?: number; now?: Date } = {},
): void {
  const hasList = repo.lists.getActive(userId) !== null
  const hasPurchases = repo.purchases.list(userId).length > 0
  if (hasList || hasPurchases) return
  seedUserData(db, repo, userId, options)
}

export function seedDatabase(db: Database, options: SeedOptions = {}): SeedResult {
  const userId = options.userId ?? DEMO_USER_ID
  const seed = options.seed ?? 42
  const repo = createRepository(db)

  resetDatabase(db)
  seedCatalog(repo, { seed })
  seedUserData(db, repo, userId, { seed, now: options.now })

  return {
    categoryCount: repo.categories.list().length,
    storeCount: repo.stores.list().length,
    productCount: repo.products.list().length,
    listItemCount: repo.lists.getActive(userId)
      ? repo.lists.listItems(repo.lists.getActive(userId)!.id).length
      : 0,
    cartLineCount: repo.carts.getActive(userId, 'store-pao-de-acucar')
      ? repo.carts.listLines(repo.carts.getActive(userId, 'store-pao-de-acucar')!.id).length
      : 0,
    purchaseCount: repo.purchases.list(userId).length,
    userId,
  }
}

export { STORES, CATEGORIES, PRODUCT_TEMPLATES }
