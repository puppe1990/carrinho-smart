import { describe, expect, it } from 'vitest'
import type { CartLine, Purchase } from './types'
import { categoryDistribution, priceTrend, purchaseMonthlyOverview } from './analytics'

function line(overrides: Partial<CartLine>): CartLine {
  return {
    id: 'l',
    productId: null,
    listItemId: null,
    name: 'Item',
    categoryId: 'mercearia',
    unit: 'un',
    unitPriceCents: overrides.unitPriceCents ?? 1000,
    listPriceCents: overrides.listPriceCents ?? overrides.unitPriceCents ?? 1000,
    quantity: 1,
    promo: false,
    isWeighed: false,
    ...overrides,
  }
}

describe('categoryDistribution', () => {
  const lines: CartLine[] = [
    line({ id: '1', categoryId: 'mercearia', unitPriceCents: 12450 }),
    line({ id: '2', categoryId: 'laticinios', unitPriceCents: 7830 }),
    line({ id: '3', categoryId: 'hortifruti', unitPriceCents: 5600 }),
    line({ id: '4', categoryId: 'higiene', unitPriceCents: 3200 }),
  ]

  it('groups totals by category and sorts descending', () => {
    const slices = categoryDistribution(lines)
    expect(slices.map((s) => s.categoryId)).toEqual([
      'mercearia',
      'laticinios',
      'hortifruti',
      'higiene',
    ])
    expect(slices[0].totalCents).toBe(12450)
  })

  it('computes each slice share of the grand total', () => {
    const slices = categoryDistribution(lines)
    expect(slices[0].percent).toBe(43)
    expect(slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100)
  })

  it('counts the number of lines per category', () => {
    const slices = categoryDistribution([
      ...lines,
      line({ id: '5', categoryId: 'mercearia', unitPriceCents: 1000 }),
    ])
    expect(slices.find((s) => s.categoryId === 'mercearia')?.count).toBe(2)
  })

  it('returns an empty array for no lines', () => {
    expect(categoryDistribution([])).toEqual([])
  })
})

describe('priceTrend', () => {
  it('detects an increase', () => {
    expect(priceTrend(3890, 3650)).toMatchObject({ direction: 'up', percent: 7 })
  })

  it('detects a decrease', () => {
    expect(priceTrend(3490, 3890)).toMatchObject({ direction: 'down', percent: 10 })
  })

  it('detects a flat price and guards against a zero baseline', () => {
    expect(priceTrend(1000, 1000).direction).toBe('flat')
    expect(priceTrend(1000, 0)).toMatchObject({ direction: 'up', percent: 0 })
  })
})

function purchase(overrides: Partial<Purchase>): Purchase {
  return {
    id: 'pur',
    storeId: 's',
    storeName: 'Mercado',
    listId: null,
    budgetCents: 35000,
    totalCents: 30000,
    savingsCents: 0,
    itemCount: 10,
    purchasedAt: '2024-05-24T11:42:00.000Z',
    ...overrides,
  }
}

describe('purchaseMonthlyOverview', () => {
  const purchases: Purchase[] = [
    purchase({ id: 'p1', totalCents: 31470, savingsCents: 4120, itemCount: 16 }),
    purchase({ id: 'p2', totalCents: 20800, savingsCents: 1500, itemCount: 12 }),
    purchase({ id: 'p3', totalCents: 10230, savingsCents: 800, itemCount: 6 }),
  ]

  it('aggregates spending, savings and frequency', () => {
    const overview = purchaseMonthlyOverview(purchases, 70000)
    expect(overview.totalCents).toBe(62500)
    expect(overview.savingsCents).toBe(6420)
    expect(overview.count).toBe(3)
  })

  it('reports budget usage and remaining headroom', () => {
    const overview = purchaseMonthlyOverview(purchases, 70000)
    expect(overview.usedPercent).toBe(89)
    expect(overview.remainingCents).toBe(7500)
    expect(overview.withinBudget).toBe(true)
  })

  it('flags overspending', () => {
    const overview = purchaseMonthlyOverview(purchases, 50000)
    expect(overview.withinBudget).toBe(false)
    expect(overview.remainingCents).toBe(0)
  })

  it('handles no purchases', () => {
    const overview = purchaseMonthlyOverview([], 50000)
    expect(overview).toMatchObject({ totalCents: 0, count: 0, usedPercent: 0 })
  })
})
