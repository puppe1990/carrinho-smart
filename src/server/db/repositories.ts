import type { Database } from 'better-sqlite3'
import { cartSummary, type CartSummary } from '../../domain/cart'
import type { CartLine, ListItem, Purchase, Unit } from '../../domain/types'
import { listProgress, type ListProgress } from '../../domain/shopping-list'
import type {
  AdminCategoryRecord,
  AdminProductRecord,
  AdminPurchaseRecord,
  AdminStoreRecord,
  AdminUserRecord,
  Cart,
  Category,
  NewCartLine,
  NewListItem,
  NewPurchase,
  NewPurchaseItem,
  PriceEntry,
  Product,
  PurchaseItem,
  ShoppingList,
  Store,
} from './models'

const uuid = () => globalThis.crypto.randomUUID()

function toCartLine(row: any): CartLine {
  return {
    id: row.id,
    productId: row.product_id,
    listItemId: row.list_item_id,
    name: row.name,
    categoryId: row.category_id,
    unit: row.unit as Unit,
    unitPriceCents: row.unit_price_cents,
    listPriceCents: row.list_price_cents,
    quantity: row.quantity,
    promo: Boolean(row.promo),
    isWeighed: Boolean(row.is_weighed),
  }
}

function toListItem(row: any): ListItem {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    aisle: row.aisle,
    expectedPriceCents: row.expected_price_cents,
    status: row.status,
    quantity: row.quantity,
    scannedPriceCents: row.scanned_price_cents,
    productId: row.product_id,
  }
}

function toProduct(row: any): Product {
  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    categoryId: row.category_id,
    unit: row.unit as Unit,
    priceCents: row.price_cents,
    imageUrl: row.image_url,
    aisle: row.aisle,
  }
}

function toShoppingList(row: any): ShoppingList {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    shoppingDate: row.shopping_date,
    budgetCents: row.budget_cents,
    status: row.status,
  }
}

function toCart(row: any): Cart {
  return {
    id: row.id,
    userId: row.user_id,
    storeId: row.store_id,
    listId: row.list_id,
    budgetCents: row.budget_cents,
    status: row.status,
    createdAt: row.created_at,
  }
}

function toPurchase(row: any): Purchase {
  return {
    id: row.id,
    storeId: row.store_id,
    storeName: row.store_name ?? '',
    listId: row.list_id,
    budgetCents: row.budget_cents,
    totalCents: row.total_cents,
    savingsCents: row.savings_cents,
    itemCount: row.item_count,
    purchasedAt: row.purchased_at,
  }
}

function toPurchaseItem(row: any): PurchaseItem {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    productId: row.product_id,
    name: row.name,
    categoryId: row.category_id,
    unitPriceCents: row.unit_price_cents,
    quantity: row.quantity,
    totalCents: row.total_cents,
    wasPromo: Boolean(row.was_promo),
  }
}

function toPriceEntry(row: any): PriceEntry {
  return {
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    priceCents: row.price_cents,
    recordedAt: row.recorded_at,
  }
}

function toAdminCategoryRecord(row: any): AdminCategoryRecord {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    productCount: row.product_count ?? 0,
    referenceCount: (row.product_count ?? 0) + (row.list_item_count ?? 0),
  }
}

function toAdminStoreRecord(row: any): AdminStoreRecord {
  return { id: row.id, name: row.name, city: row.city, usageCount: row.usage_count }
}

function toAdminProductRecord(row: any): AdminProductRecord {
  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    categoryId: row.category_id,
    categoryName: row.category_name ?? '',
    unit: row.unit as Unit,
    priceCents: row.price_cents,
    imageUrl: row.image_url,
    aisle: row.aisle,
    usageCount: row.usage_count,
  }
}

function productFilter(filter: { search?: string; categoryId?: string }): {
  clause: string
  params: unknown[]
} {
  const conditions: string[] = []
  const params: unknown[] = []
  if (filter.search) {
    conditions.push("(lower(p.name) LIKE ? OR lower(coalesce(p.brand, '')) LIKE ?)")
    const term = `%${filter.search.toLowerCase()}%`
    params.push(term, term)
  }
  if (filter.categoryId) {
    conditions.push('p.category_id = ?')
    params.push(filter.categoryId)
  }
  return { clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params }
}

function toAdminUserRecord(row: any): AdminUserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
    listCount: row.list_count,
    cartCount: row.cart_count,
    purchaseCount: row.purchase_count,
    totalSpentCents: row.total_spent_cents,
  }
}

function toAdminPurchaseRecord(row: any): AdminPurchaseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name ?? '',
    storeId: row.store_id,
    storeName: row.store_name ?? '',
    totalCents: row.total_cents,
    itemCount: row.item_count,
    purchasedAt: row.purchased_at,
  }
}

function userFilter(filter: { search?: string }): { clause: string; params: unknown[] } {
  if (!filter.search) return { clause: '', params: [] }
  const term = `%${filter.search.toLowerCase()}%`
  return {
    clause: 'WHERE (lower(u.name) LIKE ? OR lower(u.email) LIKE ?)',
    params: [term, term],
  }
}

export function createRepository(db: Database) {
  const categories = {
    upsert(category: { id: string; name: string; icon?: string; color?: string }): Category {
      db.prepare(
        `INSERT INTO categories (id, name, icon, color) VALUES (@id, @name, @icon, @color)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon, color = excluded.color`,
      ).run({
        id: category.id,
        name: category.name,
        icon: category.icon ?? 'category',
        color: category.color ?? 'primary',
      })
      return categories.get(category.id)!
    },
    insert(category: { id: string; name: string; icon?: string; color?: string }): Category {
      db.prepare(
        'INSERT INTO categories (id, name, icon, color) VALUES (@id, @name, @icon, @color)',
      ).run({
        id: category.id,
        name: category.name,
        icon: category.icon ?? 'category',
        color: category.color ?? 'primary',
      })
      return categories.get(category.id)!
    },
    update(id: string, changes: { name?: string; icon?: string; color?: string }): Category | null {
      const current = categories.get(id)
      if (!current) return null
      db.prepare('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?').run(
        changes.name ?? current.name,
        changes.icon ?? current.icon,
        changes.color ?? current.color,
        id,
      )
      return categories.get(id)
    },
    remove(id: string): void {
      db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    },
    countReferences(id: string): number {
      return categories.adminGet(id)?.referenceCount ?? 0
    },
    adminGet(id: string): AdminCategoryRecord | null {
      const row = db
        .prepare(
          `SELECT c.*,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count,
            (SELECT COUNT(*) FROM list_items li WHERE li.category_id = c.id) AS list_item_count
           FROM categories c WHERE c.id = ?`,
        )
        .get(id) as any
      return row ? toAdminCategoryRecord(row) : null
    },
    adminList(): AdminCategoryRecord[] {
      return (
        db
          .prepare(
            `SELECT c.*,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count,
              (SELECT COUNT(*) FROM list_items li WHERE li.category_id = c.id) AS list_item_count
             FROM categories c ORDER BY c.name`,
          )
          .all() as any[]
      ).map(toAdminCategoryRecord)
    },
    get(id: string): Category | null {
      const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any
      return row ? { id: row.id, name: row.name, icon: row.icon, color: row.color } : null
    },
    list(): Category[] {
      return (db.prepare('SELECT * FROM categories ORDER BY name').all() as any[]).map((row) => ({
        id: row.id,
        name: row.name,
        icon: row.icon,
        color: row.color,
      }))
    },
  }

  const stores = {
    insert(store: { id?: string; name: string; city?: string | null }): Store {
      const id = store.id ?? uuid()
      db.prepare('INSERT INTO stores (id, name, city) VALUES (?, ?, ?)').run(
        id,
        store.name,
        store.city ?? null,
      )
      return { id, name: store.name, city: store.city ?? null }
    },
    get(id: string): Store | null {
      const row = db.prepare('SELECT * FROM stores WHERE id = ?').get(id) as any
      return row ? { id: row.id, name: row.name, city: row.city } : null
    },
    list(): Store[] {
      return (db.prepare('SELECT * FROM stores ORDER BY name').all() as any[]).map((row) => ({
        id: row.id,
        name: row.name,
        city: row.city,
      }))
    },
    update(id: string, changes: { name?: string; city?: string | null }): Store | null {
      const current = stores.get(id)
      if (!current) return null
      db.prepare('UPDATE stores SET name = ?, city = ? WHERE id = ?').run(
        changes.name ?? current.name,
        changes.city === undefined ? current.city : changes.city,
        id,
      )
      return stores.get(id)
    },
    remove(id: string): void {
      db.prepare('DELETE FROM stores WHERE id = ?').run(id)
    },
    countUsage(id: string): number {
      const row = db
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM carts WHERE store_id = ?) +
            (SELECT COUNT(*) FROM purchases WHERE store_id = ?) +
            (SELECT COUNT(*) FROM price_history WHERE store_id = ?) AS total`,
        )
        .get(id, id, id) as { total: number }
      return row.total
    },
    adminGet(id: string): AdminStoreRecord | null {
      const row = db
        .prepare(
          `SELECT s.*,
            (SELECT COUNT(*) FROM carts WHERE store_id = s.id) +
            (SELECT COUNT(*) FROM purchases WHERE store_id = s.id) +
            (SELECT COUNT(*) FROM price_history WHERE store_id = s.id) AS usage_count
           FROM stores s WHERE s.id = ?`,
        )
        .get(id) as any
      return row ? toAdminStoreRecord(row) : null
    },
    adminList(): AdminStoreRecord[] {
      return (
        db
          .prepare(
            `SELECT s.*,
              (SELECT COUNT(*) FROM carts WHERE store_id = s.id) +
              (SELECT COUNT(*) FROM purchases WHERE store_id = s.id) +
              (SELECT COUNT(*) FROM price_history WHERE store_id = s.id) AS usage_count
             FROM stores s ORDER BY s.name`,
          )
          .all() as any[]
      ).map(toAdminStoreRecord)
    },
  }

  const products = {
    insert(product: {
      id?: string
      barcode: string
      name: string
      brand?: string | null
      categoryId: string
      unit?: Unit
      priceCents?: number
      imageUrl?: string | null
      aisle?: string | null
    }): Product {
      const id = product.id ?? uuid()
      db.prepare(
        `INSERT INTO products (id, barcode, name, brand, category_id, unit, price_cents, image_url, aisle)
         VALUES (@id, @barcode, @name, @brand, @categoryId, @unit, @priceCents, @imageUrl, @aisle)`,
      ).run({
        id,
        barcode: product.barcode,
        name: product.name,
        brand: product.brand ?? null,
        categoryId: product.categoryId,
        unit: product.unit ?? 'un',
        priceCents: product.priceCents ?? 0,
        imageUrl: product.imageUrl ?? null,
        aisle: product.aisle ?? null,
      })
      return products.get(id)!
    },
    get(id: string): Product | null {
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any
      return row ? toProduct(row) : null
    },
    findByBarcode(barcode: string): Product | null {
      const row = db.prepare('SELECT * FROM products WHERE barcode = ?').get(barcode) as any
      return row ? toProduct(row) : null
    },
    search(query: string): Product[] {
      const term = `%${query.toLowerCase()}%`
      return (
        db
          .prepare(
            `SELECT * FROM products
             WHERE lower(name) LIKE ? OR lower(coalesce(brand, '')) LIKE ?
             ORDER BY name LIMIT 25`,
          )
          .all(term, term) as any[]
      ).map(toProduct)
    },
    list(): Product[] {
      return (db.prepare('SELECT * FROM products ORDER BY name').all() as any[]).map(toProduct)
    },
    update(
      id: string,
      changes: {
        barcode?: string
        name?: string
        brand?: string | null
        categoryId?: string
        unit?: Unit
        priceCents?: number
        imageUrl?: string | null
        aisle?: string | null
      },
    ): Product | null {
      const current = products.get(id)
      if (!current) return null
      db.prepare(
        `UPDATE products
           SET barcode = @barcode, name = @name, brand = @brand, category_id = @categoryId,
               unit = @unit, price_cents = @priceCents, image_url = @imageUrl, aisle = @aisle
         WHERE id = @id`,
      ).run({
        id,
        barcode: changes.barcode ?? current.barcode,
        name: changes.name ?? current.name,
        brand: changes.brand === undefined ? current.brand : changes.brand,
        categoryId: changes.categoryId ?? current.categoryId,
        unit: changes.unit ?? current.unit,
        priceCents: changes.priceCents ?? current.priceCents,
        imageUrl: changes.imageUrl === undefined ? current.imageUrl : changes.imageUrl,
        aisle: changes.aisle === undefined ? current.aisle : changes.aisle,
      })
      return products.get(id)
    },
    remove(id: string): void {
      db.prepare('DELETE FROM products WHERE id = ?').run(id)
    },
    countUsage(id: string): number {
      const row = db
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM cart_items WHERE product_id = ?) +
            (SELECT COUNT(*) FROM list_items WHERE product_id = ?) +
            (SELECT COUNT(*) FROM purchase_items WHERE product_id = ?) +
            (SELECT COUNT(*) FROM price_history WHERE product_id = ?) AS total`,
        )
        .get(id, id, id, id) as { total: number }
      return row.total
    },
    adminGet(id: string): AdminProductRecord | null {
      const row = db
        .prepare(
          `SELECT p.*, c.name AS category_name,
            (SELECT COUNT(*) FROM cart_items WHERE product_id = p.id) +
            (SELECT COUNT(*) FROM list_items WHERE product_id = p.id) +
            (SELECT COUNT(*) FROM purchase_items WHERE product_id = p.id) +
            (SELECT COUNT(*) FROM price_history WHERE product_id = p.id) AS usage_count
           FROM products p LEFT JOIN categories c ON c.id = p.category_id
           WHERE p.id = ?`,
        )
        .get(id) as any
      return row ? toAdminProductRecord(row) : null
    },
    adminList(filter: {
      search?: string
      categoryId?: string
      limit?: number
      offset?: number
    }): AdminProductRecord[] {
      const { clause, params } = productFilter(filter)
      return (
        db
          .prepare(
            `SELECT p.*, c.name AS category_name,
              (SELECT COUNT(*) FROM cart_items WHERE product_id = p.id) +
              (SELECT COUNT(*) FROM list_items WHERE product_id = p.id) +
              (SELECT COUNT(*) FROM purchase_items WHERE product_id = p.id) +
              (SELECT COUNT(*) FROM price_history WHERE product_id = p.id) AS usage_count
             FROM products p LEFT JOIN categories c ON c.id = p.category_id
             ${clause}
             ORDER BY p.name LIMIT ? OFFSET ?`,
          )
          .all(...params, filter.limit ?? 50, filter.offset ?? 0) as any[]
      ).map(toAdminProductRecord)
    },
    adminCount(filter: { search?: string; categoryId?: string }): number {
      const { clause, params } = productFilter(filter)
      const row = db
        .prepare(`SELECT COUNT(*) AS total FROM products p ${clause}`)
        .get(...params) as { total: number }
      return row.total
    },
  }

  const carts = {
    getOrCreateActive(input: {
      userId: string
      storeId: string
      listId?: string | null
      budgetCents?: number
    }): Cart {
      const existing = carts.getActive(input.userId, input.storeId)
      if (existing) return existing
      const id = uuid()
      db.prepare(
        'INSERT INTO carts (id, user_id, store_id, list_id, budget_cents) VALUES (?, ?, ?, ?, ?)',
      ).run(id, input.userId, input.storeId, input.listId ?? null, input.budgetCents ?? 0)
      return carts.get(id, input.userId)!
    },
    getActive(userId: string, storeId: string): Cart | null {
      const row = db
        .prepare(
          "SELECT * FROM carts WHERE user_id = ? AND status = 'active' AND store_id = ? ORDER BY created_at DESC LIMIT 1",
        )
        .get(userId, storeId) as any
      return row ? toCart(row) : null
    },
    getLatestActive(userId: string): Cart | null {
      const row = db
        .prepare(
          "SELECT * FROM carts WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        )
        .get(userId) as any
      return row ? toCart(row) : null
    },
    get(id: string, userId?: string): Cart | null {
      const row = userId
        ? (db.prepare('SELECT * FROM carts WHERE id = ? AND user_id = ?').get(id, userId) as any)
        : (db.prepare('SELECT * FROM carts WHERE id = ?').get(id) as any)
      return row ? toCart(row) : null
    },
    updateBudget(id: string, userId: string, budgetCents: number): Cart {
      db.prepare('UPDATE carts SET budget_cents = ? WHERE id = ? AND user_id = ?').run(
        budgetCents,
        id,
        userId,
      )
      return carts.get(id, userId)!
    },
    listLines(cartId: string): CartLine[] {
      return (
        db
          .prepare('SELECT * FROM cart_items WHERE cart_id = ? ORDER BY created_at, rowid')
          .all(cartId) as any[]
      ).map(toCartLine)
    },
    listByUser(userId: string): Cart[] {
      return (
        db
          .prepare('SELECT * FROM carts WHERE user_id = ? ORDER BY created_at DESC')
          .all(userId) as any[]
      ).map(toCart)
    },
    addLine(cartId: string, input: NewCartLine): CartLine {
      const id = uuid()
      db.prepare(
        `INSERT INTO cart_items
          (id, cart_id, product_id, list_item_id, barcode, name, brand, category_id, image_url, unit,
           unit_price_cents, list_price_cents, quantity, promo, is_weighed)
         VALUES
          (@id, @cartId, @productId, @listItemId, @barcode, @name, @brand, @categoryId, @imageUrl, @unit,
           @unitPriceCents, @listPriceCents, @quantity, @promo, @isWeighed)`,
      ).run({
        id,
        cartId,
        productId: input.productId ?? null,
        listItemId: input.listItemId ?? null,
        barcode: input.barcode ?? null,
        name: input.name,
        brand: input.brand ?? null,
        categoryId: input.categoryId,
        imageUrl: input.imageUrl ?? null,
        unit: input.unit ?? 'un',
        unitPriceCents: input.unitPriceCents,
        listPriceCents: input.listPriceCents ?? input.unitPriceCents,
        quantity: input.quantity ?? 1,
        promo: input.promo ? 1 : 0,
        isWeighed: input.isWeighed ? 1 : 0,
      })
      return toCartLine(db.prepare('SELECT * FROM cart_items WHERE id = ?').get(id))
    },
    getLine(lineId: string): CartLine | null {
      const row = db.prepare('SELECT * FROM cart_items WHERE id = ?').get(lineId) as any
      return row ? toCartLine(row) : null
    },
    cartIdForLine(lineId: string): string | null {
      const row = db.prepare('SELECT cart_id FROM cart_items WHERE id = ?').get(lineId) as
        { cart_id: string } | undefined
      return row?.cart_id ?? null
    },
    updateQuantity(lineId: string, quantity: number): CartLine {
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, lineId)
      return toCartLine(db.prepare('SELECT * FROM cart_items WHERE id = ?').get(lineId))
    },
    removeLine(lineId: string): void {
      db.prepare('DELETE FROM cart_items WHERE id = ?').run(lineId)
    },
    clear(cartId: string): void {
      db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId)
    },
    summary(cartId: string): CartSummary {
      return cartSummary(carts.listLines(cartId))
    },
    checkout(cartId: string, purchasedAt = new Date().toISOString()): Purchase {
      const run = db.transaction(() => {
        const cart = carts.get(cartId)
        if (!cart) throw new Error('Carrinho não encontrado')
        const lines = carts.listLines(cartId)
        const summary = cartSummary(lines)
        const purchaseId = uuid()

        db.prepare(
          `INSERT INTO purchases
            (id, user_id, store_id, list_id, budget_cents, total_cents, savings_cents, item_count, purchased_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          purchaseId,
          cart.userId,
          cart.storeId,
          cart.listId,
          cart.budgetCents,
          summary.totalCents,
          summary.savingsCents,
          summary.kindCount,
          purchasedAt,
        )

        const insertItem = db.prepare(
          `INSERT INTO purchase_items
            (id, purchase_id, product_id, name, category_id, unit_price_cents, quantity, total_cents, was_promo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        for (const line of lines) {
          insertItem.run(
            uuid(),
            purchaseId,
            line.productId,
            line.name,
            line.categoryId,
            line.unitPriceCents,
            line.quantity,
            Math.round(line.unitPriceCents * line.quantity),
            line.promo ? 1 : 0,
          )
        }

        const insertPrice = db.prepare(
          'INSERT INTO price_history (id, user_id, product_id, store_id, price_cents, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        for (const line of lines) {
          if (line.productId) {
            insertPrice.run(
              uuid(),
              cart.userId,
              line.productId,
              cart.storeId,
              line.unitPriceCents,
              purchasedAt,
            )
          }
          if (line.listItemId) {
            db.prepare(
              "UPDATE list_items SET status = 'scanned', scanned_price_cents = ? WHERE id = ?",
            ).run(Math.round(line.unitPriceCents * line.quantity), line.listItemId)
          }
        }

        db.prepare("UPDATE carts SET status = 'checked_out', closed_at = ? WHERE id = ?").run(
          purchasedAt,
          cartId,
        )
        db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId)

        return purchaseId
      })

      const purchaseId = run() as string
      return purchases.get(purchaseId)!
    },
  }

  const lists = {
    create(input: {
      id?: string
      userId: string
      name: string
      shoppingDate: string
      budgetCents?: number
    }): ShoppingList {
      const id = input.id ?? uuid()
      db.prepare(
        'INSERT INTO shopping_lists (id, user_id, name, shopping_date, budget_cents) VALUES (?, ?, ?, ?, ?)',
      ).run(id, input.userId, input.name, input.shoppingDate, input.budgetCents ?? 0)
      return lists.get(id)!
    },
    get(id: string): ShoppingList | null {
      const row = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(id) as any
      return row ? toShoppingList(row) : null
    },
    getActive(userId: string): ShoppingList | null {
      const row = db
        .prepare(
          "SELECT * FROM shopping_lists WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        )
        .get(userId) as any
      return row ? toShoppingList(row) : null
    },
    addItem(listId: string, input: NewListItem): ListItem {
      const id = uuid()
      db.prepare(
        `INSERT INTO list_items
          (id, list_id, product_id, name, category_id, aisle, expected_price_cents, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        listId,
        input.productId ?? null,
        input.name,
        input.categoryId ?? null,
        input.aisle ?? null,
        input.expectedPriceCents ?? 0,
        input.quantity ?? 1,
      )
      return lists.getItem(id)!
    },
    addItems(listId: string, inputs: NewListItem[]): ListItem[] {
      const run = db.transaction(() => inputs.map((input) => lists.addItem(listId, input)))
      return run() as ListItem[]
    },
    getItem(id: string): ListItem | null {
      const row = db.prepare('SELECT * FROM list_items WHERE id = ?').get(id) as any
      return row ? toListItem(row) : null
    },
    listIdForItem(itemId: string): string | null {
      const row = db.prepare('SELECT list_id FROM list_items WHERE id = ?').get(itemId) as
        { list_id: string } | undefined
      return row?.list_id ?? null
    },
    listItems(listId: string): ListItem[] {
      return (
        db
          .prepare('SELECT * FROM list_items WHERE list_id = ? ORDER BY created_at, rowid')
          .all(listId) as any[]
      ).map(toListItem)
    },
    setStatus(
      itemId: string,
      status: ListItem['status'],
      scannedPriceCents?: number | null,
    ): ListItem {
      db.prepare('UPDATE list_items SET status = ?, scanned_price_cents = ? WHERE id = ?').run(
        status,
        scannedPriceCents ?? null,
        itemId,
      )
      return lists.getItem(itemId)!
    },
    removeItem(itemId: string): void {
      db.prepare('DELETE FROM list_items WHERE id = ?').run(itemId)
    },
    progress(listId: string): ListProgress {
      return listProgress(lists.listItems(listId))
    },
    listByUser(userId: string): ShoppingList[] {
      return (
        db
          .prepare('SELECT * FROM shopping_lists WHERE user_id = ? ORDER BY created_at DESC')
          .all(userId) as any[]
      ).map(toShoppingList)
    },
  }

  const purchases = {
    create(input: NewPurchase, items: NewPurchaseItem[] = []): Purchase {
      const id = input.id ?? uuid()
      const run = db.transaction(() => {
        db.prepare(
          `INSERT INTO purchases
            (id, user_id, store_id, list_id, budget_cents, total_cents, savings_cents, item_count, purchased_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.userId,
          input.storeId,
          input.listId ?? null,
          input.budgetCents,
          input.totalCents,
          input.savingsCents,
          input.itemCount,
          input.purchasedAt,
        )
        const insertItem = db.prepare(
          `INSERT INTO purchase_items
            (id, purchase_id, product_id, name, category_id, unit_price_cents, quantity, total_cents, was_promo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        for (const item of items) {
          insertItem.run(
            uuid(),
            id,
            item.productId ?? null,
            item.name,
            item.categoryId,
            item.unitPriceCents,
            item.quantity,
            item.totalCents,
            item.wasPromo ? 1 : 0,
          )
        }
      })
      run()
      return purchases.get(id)!
    },
    get(id: string, userId?: string): Purchase | null {
      const row = userId
        ? (db
            .prepare(
              `SELECT p.*, s.name AS store_name FROM purchases p
               JOIN stores s ON s.id = p.store_id WHERE p.id = ? AND p.user_id = ?`,
            )
            .get(id, userId) as any)
        : (db
            .prepare(
              `SELECT p.*, s.name AS store_name FROM purchases p
               JOIN stores s ON s.id = p.store_id WHERE p.id = ?`,
            )
            .get(id) as any)
      return row ? toPurchase(row) : null
    },
    list(userId: string): Purchase[] {
      return (
        db
          .prepare(
            `SELECT p.*, s.name AS store_name FROM purchases p
             JOIN stores s ON s.id = p.store_id
             WHERE p.user_id = ?
             ORDER BY p.purchased_at DESC`,
          )
          .all(userId) as any[]
      ).map(toPurchase)
    },
    listForMonth(userId: string, year: number, month: number): Purchase[] {
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      return (
        db
          .prepare(
            `SELECT p.*, s.name AS store_name FROM purchases p
             JOIN stores s ON s.id = p.store_id
             WHERE p.user_id = ? AND substr(p.purchased_at, 1, 7) = ?
             ORDER BY p.purchased_at DESC`,
          )
          .all(userId, prefix) as any[]
      ).map(toPurchase)
    },
    getItems(purchaseId: string): PurchaseItem[] {
      return (
        db
          .prepare('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY rowid')
          .all(purchaseId) as any[]
      ).map(toPurchaseItem)
    },
    adminCount(): number {
      const row = db.prepare('SELECT COUNT(*) AS total FROM purchases').get() as { total: number }
      return row.total
    },
    adminSumTotal(): number {
      const row = db
        .prepare('SELECT COALESCE(SUM(total_cents), 0) AS total FROM purchases')
        .get() as { total: number }
      return row.total
    },
    adminListRecent(limit: number): AdminPurchaseRecord[] {
      return (
        db
          .prepare(
            `SELECT p.id, p.user_id, u.name AS user_name, p.store_id, s.name AS store_name,
               p.total_cents, p.item_count, p.purchased_at
             FROM purchases p
             LEFT JOIN stores s ON s.id = p.store_id
             LEFT JOIN "user" u ON u.id = p.user_id
             ORDER BY p.purchased_at DESC LIMIT ?`,
          )
          .all(limit) as any[]
      ).map(toAdminPurchaseRecord)
    },
  }

  const priceHistory = {
    record(input: {
      userId: string
      productId: string
      storeId?: string | null
      priceCents: number
      recordedAt?: string
    }): void {
      db.prepare(
        'INSERT INTO price_history (id, user_id, product_id, store_id, price_cents, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        uuid(),
        input.userId,
        input.productId,
        input.storeId ?? null,
        input.priceCents,
        input.recordedAt ?? new Date().toISOString(),
      )
    },
    lastForProduct(userId: string, productId: string, storeId?: string): PriceEntry | null {
      const row = storeId
        ? (db
            .prepare(
              'SELECT * FROM price_history WHERE user_id = ? AND product_id = ? AND store_id = ? ORDER BY recorded_at DESC LIMIT 1',
            )
            .get(userId, productId, storeId) as any)
        : (db
            .prepare(
              'SELECT * FROM price_history WHERE user_id = ? AND product_id = ? ORDER BY recorded_at DESC LIMIT 1',
            )
            .get(userId, productId) as any)
      return row ? toPriceEntry(row) : null
    },
    historyForProduct(userId: string, productId: string): PriceEntry[] {
      return (
        db
          .prepare(
            'SELECT * FROM price_history WHERE user_id = ? AND product_id = ? ORDER BY recorded_at DESC',
          )
          .all(userId, productId) as any[]
      ).map(toPriceEntry)
    },
  }

  const preferences = {
    get(userId: string): { demoDataSeeded: boolean; welcomeShown: boolean } {
      const row = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId) as any
      return {
        demoDataSeeded: Boolean(row?.demo_data_seeded ?? 0),
        welcomeShown: Boolean(row?.welcome_shown ?? 0),
      }
    },
    update(
      userId: string,
      changes: { demoDataSeeded?: boolean; welcomeShown?: boolean },
    ): { demoDataSeeded: boolean; welcomeShown: boolean } {
      const current = preferences.get(userId)
      const next = {
        demoDataSeeded: changes.demoDataSeeded ?? current.demoDataSeeded,
        welcomeShown: changes.welcomeShown ?? current.welcomeShown,
      }
      db.prepare(
        `INSERT INTO user_preferences (user_id, demo_data_seeded, welcome_shown)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           demo_data_seeded = excluded.demo_data_seeded,
           welcome_shown = excluded.welcome_shown`,
      ).run(userId, next.demoDataSeeded ? 1 : 0, next.welcomeShown ? 1 : 0)
      return next
    },
  }

  const users = {
    list(filter: { search?: string; limit?: number; offset?: number } = {}): AdminUserRecord[] {
      const { clause, params } = userFilter(filter)
      return (
        db
          .prepare(
            `SELECT u.id, u.name, u.email, u.createdAt,
              (SELECT COUNT(*) FROM shopping_lists sl WHERE sl.user_id = u.id) AS list_count,
              (SELECT COUNT(*) FROM carts c WHERE c.user_id = u.id) AS cart_count,
              (SELECT COUNT(*) FROM purchases p WHERE p.user_id = u.id) AS purchase_count,
              (SELECT COALESCE(SUM(p.total_cents), 0) FROM purchases p WHERE p.user_id = u.id) AS total_spent_cents
             FROM "user" u ${clause}
             ORDER BY u.createdAt DESC, u.id DESC LIMIT ? OFFSET ?`,
          )
          .all(...params, filter.limit ?? 50, filter.offset ?? 0) as any[]
      ).map(toAdminUserRecord)
    },
    count(filter: { search?: string } = {}): number {
      const { clause, params } = userFilter(filter)
      const row = db.prepare(`SELECT COUNT(*) AS total FROM "user" u ${clause}`).get(...params) as {
        total: number
      }
      return row.total
    },
    get(id: string): AdminUserRecord | null {
      const row = db
        .prepare(
          `SELECT u.id, u.name, u.email, u.createdAt,
            (SELECT COUNT(*) FROM shopping_lists sl WHERE sl.user_id = u.id) AS list_count,
            (SELECT COUNT(*) FROM carts c WHERE c.user_id = u.id) AS cart_count,
            (SELECT COUNT(*) FROM purchases p WHERE p.user_id = u.id) AS purchase_count,
            (SELECT COALESCE(SUM(p.total_cents), 0) FROM purchases p WHERE p.user_id = u.id) AS total_spent_cents
           FROM "user" u WHERE u.id = ?`,
        )
        .get(id) as any
      return row ? toAdminUserRecord(row) : null
    },
  }

  return { categories, stores, products, carts, lists, purchases, priceHistory, preferences, users }
}

export type Repository = ReturnType<typeof createRepository>
