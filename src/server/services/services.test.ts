import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type Database } from '../db/client'
import { createRepository, type Repository } from '../db/repositories'
import { DEMO_USER_ID, seedDatabase } from '../db/seed'
import {
  addLine,
  checkout,
  clearCart,
  getCartOverview,
  removeLine,
  setBudget,
  updateLineQuantity,
} from './cart-service'
import { lookupBarcode, searchProducts } from './scanner-service'
import { addQuickItem, getShoppingListOverview, scanListItem } from './list-service'
import {
  getHistory,
  getMonthSummary,
  getPurchaseSummary,
  listAvailableMonths,
} from './history-service'

let db: Database
let repo: Repository
const USER = DEMO_USER_ID
const OTHER_USER = 'user-other'
const STORE_ID = 'store-pao-de-acucar'

beforeEach(() => {
  db = createDatabase(':memory:')
  repo = createRepository(db)
  seedDatabase(db, { seed: 42 })
})

describe('cart service', () => {
  it('returns a full overview for the active cart', () => {
    const overview = getCartOverview(repo, USER, STORE_ID)
    expect(overview.store?.id).toBe(STORE_ID)
    expect(overview.cart.userId).toBe(USER)
    expect(overview.lines.length).toBeGreaterThan(0)
    expect(overview.summary.totalCents).toBeGreaterThan(0)
    expect(overview.budget.limitCents).toBe(35000)
    expect(overview.stores.length).toBeGreaterThan(1)
    expect(overview.listName).toBe('Compras do Mês - Família')
  })

  it('flags extra items that were not planned on the list', () => {
    const cart = repo.carts.getActive(USER, STORE_ID)!
    repo.carts.addLine(cart.id, {
      name: 'Chocolate Amargo 70%',
      categoryId: 'mercearia',
      unitPriceCents: 990,
      listPriceCents: 990,
    })
    const overview = getCartOverview(repo, USER, STORE_ID)
    expect(overview.extraItems.length).toBeGreaterThan(0)
    expect(overview.tip.extraImpactCents).toBeGreaterThan(0)
  })

  it('updates budget, quantities, additions and removals', () => {
    const overview = getCartOverview(repo, USER, STORE_ID)
    const cartId = overview.cart.id

    expect(setBudget(repo, USER, cartId, 50000).budgetCents).toBe(50000)

    const added = addLine(repo, USER, cartId, {
      name: 'Refrigerante 2L',
      categoryId: 'mercearia',
      unitPriceCents: 890,
      quantity: 2,
    })
    expect(added.summary.kindCount).toBe(overview.summary.kindCount + 1)

    const updated = updateLineQuantity(repo, USER, added.line.id, 5)
    expect(updated.line.quantity).toBe(5)

    const afterRemove = removeLine(repo, USER, added.line.id)
    expect(afterRemove.kindCount).toBe(overview.summary.kindCount)

    expect(clearCart(repo, USER, cartId).kindCount).toBe(0)
  })

  it('checks out the cart into a purchase', () => {
    const overview = getCartOverview(repo, USER, STORE_ID)
    const purchase = checkout(repo, USER, overview.cart.id)
    expect(purchase.id).toBeTruthy()
    expect(purchase.totalCents).toBe(overview.summary.totalCents)
    expect(repo.carts.get(overview.cart.id, USER)?.status).toBe('checked_out')
  })

  it('defaults to the store of the active cart instead of the first alphabetically', () => {
    const overview = getCartOverview(repo, USER)
    expect(overview.store?.id).toBe(STORE_ID)
    expect(overview.lines.length).toBeGreaterThan(0)
  })

  it('refuses to operate on another user cart', () => {
    const overview = getCartOverview(repo, USER, STORE_ID)
    expect(() => getCartOverview(repo, OTHER_USER, STORE_ID)).not.toThrow()
    expect(() => setBudget(repo, OTHER_USER, overview.cart.id, 1000)).toThrow()
    expect(() => checkout(repo, OTHER_USER, overview.cart.id)).toThrow()
  })
})

describe('scanner service', () => {
  it('looks up a known barcode and suggests the current price', () => {
    const product = repo.products.list()[0]
    repo.priceHistory.record({
      userId: USER,
      productId: product.id,
      storeId: STORE_ID,
      priceCents: product.priceCents - 200,
      recordedAt: '2024-04-01T10:00:00.000Z',
    })
    const result = lookupBarcode(repo, USER, product.barcode, STORE_ID)
    expect(result?.product.id).toBe(product.id)
    expect(result?.previousPriceCents).toBe(product.priceCents - 200)
    expect(result?.suggestedPriceCents).toBe(product.priceCents)
  })

  it('does not leak another user price history', () => {
    const product = repo.products.list()[0]
    repo.priceHistory.record({
      userId: USER,
      productId: product.id,
      storeId: STORE_ID,
      priceCents: product.priceCents - 200,
      recordedAt: '2024-04-01T10:00:00.000Z',
    })
    const result = lookupBarcode(repo, OTHER_USER, product.barcode, STORE_ID)
    expect(result?.previousPriceCents).toBe(product.priceCents)
  })

  it('returns null for unknown barcodes', () => {
    expect(lookupBarcode(repo, USER, '0000000000000', STORE_ID)).toBeNull()
  })

  it('searches the catalogue', () => {
    expect(searchProducts(repo, 'leite').length).toBeGreaterThan(0)
  })
})

describe('list service', () => {
  it('returns the list, items and progress', () => {
    const overview = getShoppingListOverview(repo, USER)
    expect(overview.list?.id).toBe(`list-${USER}`)
    expect(overview.progress.total).toBeGreaterThan(0)
    expect(overview.items.length).toBe(overview.progress.total)
  })

  it('adds a quick item to the list', () => {
    const overview = getShoppingListOverview(repo, USER)
    const created = addQuickItem(repo, USER, overview.list!.id, '  Guardanapos  ')
    expect(created.name).toBe('Guardanapos')
    const refreshed = getShoppingListOverview(repo, USER)
    expect(refreshed.items.some((i) => i.id === created.id)).toBe(true)
  })

  it('scans a list item into the cart and marks it as scanned', () => {
    const overview = getShoppingListOverview(repo, USER)
    const cart = repo.carts.getActive(USER, STORE_ID)!
    const pending = overview.items.find((item) => item.status === 'pending')!

    const result = scanListItem(repo, USER, pending.id, {
      cartId: cart.id,
      unitPriceCents: 1234,
      quantity: 1,
    })

    expect(result.line.listItemId).toBe(pending.id)
    expect(result.line.unitPriceCents).toBe(1234)
    expect(repo.lists.getItem(pending.id)?.status).toBe('scanned')
    expect(getShoppingListOverview(repo, USER).progress.scannedCount).toBe(
      overview.progress.scannedCount + 1,
    )
  })

  it('rejects scanning an item from another user list', () => {
    const overview = getShoppingListOverview(repo, USER)
    const cart = repo.carts.getActive(USER, STORE_ID)!
    const pending = overview.items.find((item) => item.status === 'pending')!
    expect(() =>
      scanListItem(repo, OTHER_USER, pending.id, { cartId: cart.id, unitPriceCents: 100 }),
    ).toThrow()
  })
})

describe('history service', () => {
  it('aggregates purchases for a month', () => {
    const months = listAvailableMonths(repo, USER)
    expect(months.length).toBeGreaterThanOrEqual(2)

    const { year, month } = months[0]
    const history = getHistory(repo, USER, year, month)
    expect(history.purchases.length).toBeGreaterThan(0)
    expect(history.overview.count).toBe(history.purchases.length)
    expect(history.overview.totalCents).toBeGreaterThan(0)
    expect(listAvailableMonths(repo, OTHER_USER)).toHaveLength(0)
  })

  it('uses the monthly budget for the overview when set', () => {
    repo.preferences.update(USER, { monthlyBudgetCents: 100000 })
    const months = listAvailableMonths(repo, USER)
    const { year, month } = months[0]
    const summary = getMonthSummary(repo, USER, year, month)
    expect(summary.monthlyBudgetCents).toBe(100000)
    expect(summary.overview.budgetCents).toBe(100000)
  })

  it('builds a purchase summary with category distribution', () => {
    const purchase = repo.purchases.list(USER)[0]
    const summary = getPurchaseSummary(repo, USER, purchase.id)!
    expect(summary.purchase.id).toBe(purchase.id)
    expect(summary.items.length).toBeGreaterThan(0)
    expect(summary.distribution.length).toBeGreaterThan(0)
    expect(summary.budget.spentCents).toBe(purchase.totalCents)
  })

  it('does not expose another user purchase', () => {
    const purchase = repo.purchases.list(USER)[0]
    expect(getPurchaseSummary(repo, OTHER_USER, purchase.id)).toBeNull()
  })

  it('returns null for an unknown purchase', () => {
    expect(getPurchaseSummary(repo, USER, 'nope')).toBeNull()
  })
})
