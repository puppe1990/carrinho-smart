import {
  categoryDistribution,
  purchaseMonthlyOverview,
  type MonthlyOverview,
} from '../../domain/analytics'
import { budgetStatus, type BudgetStatus } from '../../domain/budget'
import type { Purchase } from '../../domain/types'
import type { Category, PurchaseItem } from '../db/models'
import type { Repository } from '../db/repositories'

export interface MonthRef {
  year: number
  month: number
  key: string
  label: string
}

export interface EnrichedCategorySlice {
  categoryId: string
  name: string
  icon: string
  color: string
  totalCents: number
  count: number
  percent: number
}

export interface PurchaseSummary {
  purchase: Purchase
  items: PurchaseItem[]
  distribution: EnrichedCategorySlice[]
  budget: BudgetStatus
  categories: Category[]
}

export function monthLabel(year: number, month: number): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function listAvailableMonths(repo: Repository, userId: string): MonthRef[] {
  const seen = new Map<string, MonthRef>()
  for (const purchase of repo.purchases.list(userId)) {
    const date = new Date(purchase.purchasedAt)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const key = `${year}-${String(month).padStart(2, '0')}`
    if (!seen.has(key)) seen.set(key, { year, month, key, label: monthLabel(year, month) })
  }
  return [...seen.values()].sort((a, b) => b.key.localeCompare(a.key))
}

export function getHistory(
  repo: Repository,
  userId: string,
  year: number,
  month: number,
): {
  year: number
  month: number
  label: string
  purchases: Purchase[]
  stores: ReturnType<Repository['stores']['list']>
  overview: MonthlyOverview
} {
  const purchases = repo.purchases.listForMonth(userId, year, month)
  const budgetCents = purchases.reduce((sum, purchase) => sum + purchase.budgetCents, 0)
  return {
    year,
    month,
    label: monthLabel(year, month),
    purchases,
    stores: repo.stores.list(),
    overview: purchaseMonthlyOverview(purchases, budgetCents),
  }
}

function enrichDistribution(
  repo: Repository,
  lines: Array<{ categoryId: string; unitPriceCents: number; quantity: number }>,
): EnrichedCategorySlice[] {
  const byId = new Map(repo.categories.list().map((category) => [category.id, category]))
  return categoryDistribution(lines).map((slice) => {
    const category = byId.get(slice.categoryId)
    return {
      ...slice,
      name: category?.name ?? slice.categoryId,
      icon: category?.icon ?? 'category',
      color: category?.color ?? 'primary',
    }
  })
}

export function getPurchaseSummary(
  repo: Repository,
  userId: string,
  purchaseId: string,
): PurchaseSummary | null {
  const purchase = repo.purchases.get(purchaseId, userId)
  if (!purchase) return null

  const items = repo.purchases.getItems(purchaseId)

  return {
    purchase,
    items,
    distribution: enrichDistribution(repo, items),
    budget: budgetStatus(purchase.totalCents, purchase.budgetCents),
    categories: repo.categories.list(),
  }
}

export interface MonthSummary {
  year: number
  month: number
  label: string
  purchases: Purchase[]
  items: PurchaseItem[]
  distribution: EnrichedCategorySlice[]
  overview: MonthlyOverview
  stores: ReturnType<Repository['stores']['list']>
}

export function getMonthSummary(
  repo: Repository,
  userId: string,
  year: number,
  month: number,
): MonthSummary {
  const purchases = repo.purchases.listForMonth(userId, year, month)
  const items = purchases.flatMap((purchase) => repo.purchases.getItems(purchase.id))
  const budgetCents = purchases.reduce((sum, purchase) => sum + purchase.budgetCents, 0)

  return {
    year,
    month,
    label: monthLabel(year, month),
    purchases,
    items,
    distribution: enrichDistribution(repo, items),
    overview: purchaseMonthlyOverview(purchases, budgetCents),
    stores: repo.stores.list(),
  }
}
