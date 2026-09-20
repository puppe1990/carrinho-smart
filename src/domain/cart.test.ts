import { describe, expect, it } from 'vitest'
import type { CartLine, ListItem } from './types'
import {
  cartSummary,
  changedQuantity,
  detectExtraItems,
  lineTotalCents,
} from './cart'

function line(overrides: Partial<CartLine>): CartLine {
  return {
    id: 'line',
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

describe('lineTotalCents', () => {
  it('multiplies unit price by quantity', () => {
    expect(lineTotalCents(line({ unitPriceCents: 1890, quantity: 2 }))).toBe(3780)
  })

  it('rounds weighed lines to the nearest cent', () => {
    expect(
      lineTotalCents(line({ unitPriceCents: 699, quantity: 1.45, unit: 'kg', isWeighed: true })),
    ).toBe(1014)
  })
})

describe('cartSummary', () => {
  const lines: CartLine[] = [
    line({ id: 'a', name: 'Café', unitPriceCents: 1890, listPriceCents: 2090, quantity: 2 }),
    line({ id: 'b', name: 'Leite', unitPriceCents: 549, quantity: 6 }),
    line({ id: 'c', name: 'Queijo', unitPriceCents: 2250, quantity: 1 }),
    line({ id: 'd', name: 'Detergente', unitPriceCents: 289, listPriceCents: 349, quantity: 3 }),
  ]

  it('totals kinds, units and value', () => {
    const summary = cartSummary(lines)
    expect(summary.kindCount).toBe(4)
    expect(summary.unitCount).toBe(12)
    expect(summary.totalCents).toBe(10191)
  })

  it('accumulates savings from promotional list prices', () => {
    const summary = cartSummary(lines)
    expect(summary.savingsCents).toBe(580)
  })

  it('returns zeroed metrics for an empty cart', () => {
    expect(cartSummary([])).toEqual({
      kindCount: 0,
      unitCount: 0,
      totalCents: 0,
      savingsCents: 0,
    })
  })
})

describe('changedQuantity', () => {
  it('applies a delta', () => {
    expect(changedQuantity(2, 1)).toBe(3)
    expect(changedQuantity(2, -1)).toBe(1)
  })

  it('never drops below the minimum', () => {
    expect(changedQuantity(1, -1)).toBe(1)
    expect(changedQuantity(0.5, -1, 0.1)).toBeCloseTo(0.1)
  })
})

describe('detectExtraItems', () => {
  const listItems: ListItem[] = [
    {
      id: 'li-1',
      name: 'Café',
      categoryId: 'mercearia',
      aisle: 'Corredor 3',
      expectedPriceCents: 2090,
      status: 'scanned',
      quantity: 2,
      scannedPriceCents: 1890,
      productId: 'p-1',
    },
  ]

  it('returns cart lines that were not planned on the list', () => {
    const extra = detectExtraItems(
      listItems,
      [
        line({ id: 'scan-1', listItemId: 'li-1' }),
        line({ id: 'scan-2', listItemId: null, name: 'Chocolate' }),
      ],
    )
    expect(extra.map((l) => l.id)).toEqual(['scan-2'])
  })

  it('is empty when everything was planned', () => {
    expect(detectExtraItems(listItems, [line({ listItemId: 'li-1' })])).toEqual([])
  })
})
