import type { Database } from 'better-sqlite3'
import { cartSummary, type CartSummary } from '../../domain/cart'
import type { CartLine, ListItem, Purchase, Unit } from '../../domain/types'
import { listProgress, type ListProgress } from '../../domain/shopping-list'
import type {
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
    name: row.name,
    shoppingDate: row.shopping_date,
    budgetCents: row.budget_cents,
    status: row.status,
  }
}

function toCart(row: any): Cart {
  return {
    id: row.id,
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
  }

  const carts = {
    getOrCreateActive(input: {
      storeId: string
      listId?: string | null
      budgetCents?: number
    }): Cart {
      const existing = carts.getActive(input.storeId)
      if (existing) return existing
      const id = uuid()
      db.prepare(
        'INSERT INTO carts (id, store_id, list_id, budget_cents) VALUES (?, ?, ?, ?)',
      ).run(id, input.storeId, input.listId ?? null, input.budgetCents ?? 0)
      return carts.get(id)!
    },
    getActive(storeId: string): Cart | null {
      const row = db
        .prepare("SELECT * FROM carts WHERE status = 'active' AND store_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(storeId) as any
      return row ? toCart(row) : null
    },
    get(id: string): Cart | null {
      const row = db.prepare('SELECT * FROM carts WHERE id = ?').get(id) as any
      return row ? toCart(row) : null
    },
    updateBudget(id: string, budgetCents: number): Cart {
      db.prepare('UPDATE carts SET budget_cents = ? WHERE id = ?').run(budgetCents, id)
      return carts.get(id)!
    },
    listLines(cartId: string): CartLine[] {
      return (
        db
          .prepare('SELECT * FROM cart_items WHERE cart_id = ? ORDER BY created_at, rowid')
          .all(cartId) as any[]
      ).map(toCartLine)
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
        | { cart_id: string }
        | undefined
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
            (id, store_id, list_id, budget_cents, total_cents, savings_cents, item_count, purchased_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          purchaseId,
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
          'INSERT INTO price_history (id, product_id, store_id, price_cents, recorded_at) VALUES (?, ?, ?, ?, ?)',
        )
        for (const line of lines) {
          if (line.productId) {
            insertPrice.run(uuid(), line.productId, cart.storeId, line.unitPriceCents, purchasedAt)
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
    create(input: { id?: string; name: string; shoppingDate: string; budgetCents?: number }): ShoppingList {
      const id = input.id ?? uuid()
      db.prepare(
        'INSERT INTO shopping_lists (id, name, shopping_date, budget_cents) VALUES (?, ?, ?, ?)',
      ).run(id, input.name, input.shoppingDate, input.budgetCents ?? 0)
      return lists.get(id)!
    },
    get(id: string): ShoppingList | null {
      const row = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(id) as any
      return row ? toShoppingList(row) : null
    },
    getActive(): ShoppingList | null {
      const row = db
        .prepare("SELECT * FROM shopping_lists WHERE status = 'active' ORDER BY created_at DESC LIMIT 1")
        .get() as any
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
        | { list_id: string }
        | undefined
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
  }

  const purchases = {
    create(input: NewPurchase, items: NewPurchaseItem[] = []): Purchase {
      const id = input.id ?? uuid()
      const run = db.transaction(() => {
        db.prepare(
          `INSERT INTO purchases
            (id, store_id, list_id, budget_cents, total_cents, savings_cents, item_count, purchased_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
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
    get(id: string): Purchase | null {
      const row = db
        .prepare(
          `SELECT p.*, s.name AS store_name FROM purchases p
           JOIN stores s ON s.id = p.store_id WHERE p.id = ?`,
        )
        .get(id) as any
      return row ? toPurchase(row) : null
    },
    list(): Purchase[] {
      return (
        db
          .prepare(
            `SELECT p.*, s.name AS store_name FROM purchases p
             JOIN stores s ON s.id = p.store_id ORDER BY p.purchased_at DESC`,
          )
          .all() as any[]
      ).map(toPurchase)
    },
    listForMonth(year: number, month: number): Purchase[] {
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      return (
        db
          .prepare(
            `SELECT p.*, s.name AS store_name FROM purchases p
             JOIN stores s ON s.id = p.store_id
             WHERE substr(p.purchased_at, 1, 7) = ?
             ORDER BY p.purchased_at DESC`,
          )
          .all(prefix) as any[]
      ).map(toPurchase)
    },
    getItems(purchaseId: string): PurchaseItem[] {
      return (
        db
          .prepare('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY rowid')
          .all(purchaseId) as any[]
      ).map(toPurchaseItem)
    },
  }

  const priceHistory = {
    record(input: {
      productId: string
      storeId?: string | null
      priceCents: number
      recordedAt?: string
    }): void {
      db.prepare(
        'INSERT INTO price_history (id, product_id, store_id, price_cents, recorded_at) VALUES (?, ?, ?, ?, ?)',
      ).run(
        uuid(),
        input.productId,
        input.storeId ?? null,
        input.priceCents,
        input.recordedAt ?? new Date().toISOString(),
      )
    },
    lastForProduct(productId: string, storeId?: string): PriceEntry | null {
      const row = storeId
        ? (db
            .prepare(
              'SELECT * FROM price_history WHERE product_id = ? AND store_id = ? ORDER BY recorded_at DESC LIMIT 1',
            )
            .get(productId, storeId) as any)
        : (db
            .prepare('SELECT * FROM price_history WHERE product_id = ? ORDER BY recorded_at DESC LIMIT 1')
            .get(productId) as any)
      return row ? toPriceEntry(row) : null
    },
    historyForProduct(productId: string): PriceEntry[] {
      return (
        db
          .prepare('SELECT * FROM price_history WHERE product_id = ? ORDER BY recorded_at DESC')
          .all(productId) as any[]
      ).map(toPriceEntry)
    },
  }

  return { categories, stores, products, carts, lists, purchases, priceHistory }
}

export type Repository = ReturnType<typeof createRepository>
