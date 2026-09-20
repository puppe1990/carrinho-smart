import { describe, expect, it } from 'vitest'
import type { ListItem } from './types'
import { groupByStatus, listProgress, quickAddItem } from './shopping-list'

function item(overrides: Partial<ListItem>): ListItem {
  return {
    id: 'li',
    name: 'Item',
    categoryId: null,
    aisle: null,
    expectedPriceCents: 1000,
    status: 'pending',
    quantity: 1,
    scannedPriceCents: null,
    productId: null,
    ...overrides,
  }
}

describe('listProgress', () => {
  const items: ListItem[] = [
    item({ id: '1', status: 'scanned', expectedPriceCents: 4000, scannedPriceCents: 3780 }),
    item({ id: '2', status: 'scanned', expectedPriceCents: 2400, scannedPriceCents: 2250 }),
    item({ id: '3', status: 'pending', expectedPriceCents: 850 }),
    item({ id: '4', status: 'pending', expectedPriceCents: 1600 }),
  ]

  it('counts scanned and pending items', () => {
    const progress = listProgress(items)
    expect(progress.total).toBe(4)
    expect(progress.scannedCount).toBe(2)
    expect(progress.pendingCount).toBe(2)
    expect(progress.remainingCount).toBe(2)
  })

  it('computes the scanned percentage', () => {
    expect(listProgress(items).percentScanned).toBe(50)
  })

  it('sums expected and actually scanned values', () => {
    const progress = listProgress(items)
    expect(progress.expectedTotalCents).toBe(8850)
    expect(progress.scannedTotalCents).toBe(6030)
  })

  it('handles an empty list', () => {
    const progress = listProgress([])
    expect(progress.percentScanned).toBe(0)
    expect(progress.total).toBe(0)
    expect(progress.expectedTotalCents).toBe(0)
  })
})

describe('groupByStatus', () => {
  it('splits items into pending and scanned buckets', () => {
    const { pending, scanned } = groupByStatus([
      item({ id: '1', status: 'pending' }),
      item({ id: '2', status: 'scanned' }),
      item({ id: '3', status: 'pending' }),
    ])
    expect(pending.map((i) => i.id)).toEqual(['1', '3'])
    expect(scanned.map((i) => i.id)).toEqual(['2'])
  })
})

describe('quickAddItem', () => {
  it('creates a pending custom item with a trimmed name', () => {
    const created = quickAddItem('  Arroz Integral  ')
    expect(created).toMatchObject({
      name: 'Arroz Integral',
      status: 'pending',
      categoryId: null,
      expectedPriceCents: 0,
      quantity: 1,
    })
    expect(created.id).toBeTruthy()
  })

  it('rejects an empty name', () => {
    expect(() => quickAddItem('   ')).toThrow()
  })
})
