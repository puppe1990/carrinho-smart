import { describe, expect, it, beforeEach } from 'vitest'
import { createDatabase, type Database } from './client'
import { createRepository, type Repository } from './repositories'
import { resetDatabase, seedDatabase } from './seed'

let db: Database
let repo: Repository

beforeEach(() => {
  db = createDatabase(':memory:')
  repo = createRepository(db)
})

describe('seedDatabase', () => {
  it('populates categories, stores and products', () => {
    const result = seedDatabase(db, { seed: 42 })
    expect(result.categoryCount).toBeGreaterThanOrEqual(5)
    expect(result.storeCount).toBeGreaterThanOrEqual(3)
    expect(result.productCount).toBeGreaterThanOrEqual(20)
    expect(repo.products.list().length).toBe(result.productCount)
  })

  it('creates an active list with pending and scanned items', () => {
    seedDatabase(db, { seed: 42 })
    const list = repo.lists.getActive()
    expect(list).not.toBeNull()
    const items = repo.lists.listItems(list!.id)
    expect(items.some((i) => i.status === 'pending')).toBe(true)
    expect(items.some((i) => i.status === 'scanned')).toBe(true)
  })

  it('creates an active cart with lines and a searchable catalogue', () => {
    seedDatabase(db, { seed: 42 })
    const cart = repo.carts.getActive('store-pao-de-acucar')
    expect(cart).not.toBeNull()
    expect(repo.carts.listLines(cart!.id).length).toBeGreaterThanOrEqual(4)

    const anyProduct = repo.products.list()[0]
    expect(repo.products.findByBarcode(anyProduct.barcode)?.id).toBe(anyProduct.id)
  })

  it('creates historical purchases with items', () => {
    seedDatabase(db, { seed: 42 })
    const purchases = repo.purchases.list()
    expect(purchases.length).toBeGreaterThanOrEqual(3)
    for (const purchase of purchases) {
      expect(repo.purchases.getItems(purchase.id).length).toBeGreaterThan(0)
      expect(purchase.totalCents).toBeGreaterThan(0)
    }
    const months = new Set(purchases.map((p) => p.purchasedAt.slice(0, 7)))
    expect(months.size).toBeGreaterThanOrEqual(2)
  })

  it('is deterministic for a given seed', () => {
    const other = createDatabase(':memory:')
    seedDatabase(db, { seed: 7 })
    seedDatabase(other, { seed: 7 })
    expect(repo.products.list().map((p) => p.name)).toEqual(
      createRepository(other).products.list().map((p) => p.name),
    )
  })

  it('resets cleanly when run twice', () => {
    seedDatabase(db, { seed: 42 })
    const firstCount = repo.products.list().length
    seedDatabase(db, { seed: 42 })
    expect(repo.products.list().length).toBe(firstCount)
    expect(repo.products.list().length).not.toBe(firstCount * 2)
  })
})

describe('resetDatabase', () => {
  it('clears every table', () => {
    seedDatabase(db, { seed: 42 })
    resetDatabase(db)
    expect(repo.products.list()).toHaveLength(0)
    expect(repo.purchases.list()).toHaveLength(0)
    expect(repo.stores.list()).toHaveLength(0)
  })
})
