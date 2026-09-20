import type { ListItem } from './types'

export interface ListProgress {
  total: number
  scannedCount: number
  pendingCount: number
  remainingCount: number
  percentScanned: number
  expectedTotalCents: number
  scannedTotalCents: number
}

export function listProgress(items: ListItem[]): ListProgress {
  const total = items.length
  const scanned = items.filter((item) => item.status === 'scanned')
  const scannedCount = scanned.length
  const pendingCount = total - scannedCount

  return {
    total,
    scannedCount,
    pendingCount,
    remainingCount: pendingCount,
    percentScanned: total === 0 ? 0 : Math.round((scannedCount / total) * 100),
    expectedTotalCents: items.reduce((sum, item) => sum + item.expectedPriceCents, 0),
    scannedTotalCents: scanned.reduce(
      (sum, item) => sum + (item.scannedPriceCents ?? item.expectedPriceCents),
      0,
    ),
  }
}

export function groupByStatus(items: ListItem[]): {
  pending: ListItem[]
  scanned: ListItem[]
} {
  return {
    pending: items.filter((item) => item.status === 'pending'),
    scanned: items.filter((item) => item.status === 'scanned'),
  }
}

export function quickAddItem(name: string): ListItem {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Informe o nome do item')
  return {
    id: globalThis.crypto.randomUUID(),
    name: trimmed,
    categoryId: null,
    aisle: null,
    expectedPriceCents: 0,
    status: 'pending',
    quantity: 1,
    scannedPriceCents: null,
    productId: null,
  }
}
