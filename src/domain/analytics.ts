import { lineTotalCents } from './cart'
import type { CartLine, Purchase } from './types'

export interface CategorySlice {
  categoryId: string
  totalCents: number
  count: number
  percent: number
}

export interface MonthlyOverview {
  totalCents: number
  count: number
  savingsCents: number
  budgetCents: number
  usedPercent: number
  remainingCents: number
  withinBudget: boolean
}

export interface PriceTrend {
  direction: 'up' | 'down' | 'flat'
  percent: number
}

export type DistributableLine = Pick<CartLine, 'categoryId' | 'unitPriceCents' | 'quantity'>

export function categoryDistribution(lines: DistributableLine[]): CategorySlice[] {
  const buckets = new Map<string, { totalCents: number; count: number }>()

  for (const line of lines) {
    const bucket = buckets.get(line.categoryId) ?? { totalCents: 0, count: 0 }
    bucket.totalCents += lineTotalCents(line)
    bucket.count += 1
    buckets.set(line.categoryId, bucket)
  }

  const grandTotal = [...buckets.values()].reduce((sum, b) => sum + b.totalCents, 0)

  return [...buckets.entries()]
    .map(([categoryId, bucket]) => ({
      categoryId,
      totalCents: bucket.totalCents,
      count: bucket.count,
      percent: grandTotal === 0 ? 0 : Math.round((bucket.totalCents / grandTotal) * 100),
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.categoryId.localeCompare(b.categoryId))
}

export function priceTrend(currentCents: number, previousCents: number): PriceTrend {
  if (previousCents <= 0) {
    return { direction: currentCents > 0 ? 'up' : 'flat', percent: 0 }
  }
  const diff = currentCents - previousCents
  if (diff === 0) return { direction: 'flat', percent: 0 }
  return {
    direction: diff > 0 ? 'up' : 'down',
    percent: Math.round((Math.abs(diff) / previousCents) * 100),
  }
}

export function purchaseMonthlyOverview(
  purchases: Purchase[],
  budgetCents: number,
): MonthlyOverview {
  const totalCents = purchases.reduce((sum, purchase) => sum + purchase.totalCents, 0)
  const savingsCents = purchases.reduce((sum, purchase) => sum + purchase.savingsCents, 0)

  return {
    totalCents,
    count: purchases.length,
    savingsCents,
    budgetCents,
    usedPercent: budgetCents <= 0 ? 0 : Math.round((totalCents / budgetCents) * 100),
    remainingCents: Math.max(0, budgetCents - totalCents),
    withinBudget: totalCents <= budgetCents,
  }
}
