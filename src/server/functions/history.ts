import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '../auth/session'
import {
  getCurrentMonthBudget,
  getHistory,
  getMonthSummary,
  getPurchaseSummary,
  listAvailableMonths,
} from '../services/history-service'

export const fetchMonthBudget = createServerFn({ method: 'GET' }).handler(async () => {
  const { repo, user } = await requireSession()
  return getCurrentMonthBudget(repo, user.id)
})

export const fetchMonths = createServerFn({ method: 'GET' }).handler(async () => {
  const { repo, user } = await requireSession()
  return listAvailableMonths(repo, user.id)
})

export const fetchHistory = createServerFn({ method: 'GET' })
  .validator((data: { year: number; month: number }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return getHistory(repo, user.id, data.year, data.month)
  })

export const fetchMonthSummary = createServerFn({ method: 'GET' })
  .validator((data: { year?: number; month?: number }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    const months = listAvailableMonths(repo, user.id)
    const target =
      months.find((month) => month.year === data.year && month.month === data.month) ?? months[0]
    if (!target) return null
    return getMonthSummary(repo, user.id, target.year, target.month)
  })

export const fetchPurchaseSummary = createServerFn({ method: 'GET' })
  .validator((data: { purchaseId: string }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return getPurchaseSummary(repo, user.id, data.purchaseId)
  })

export const changeMonthlyBudget = createServerFn({ method: 'POST' })
  .validator((data: { budgetCents: number }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    const budgetCents = Math.max(0, Math.round(Number(data.budgetCents) || 0))
    return repo.preferences.update(user.id, { monthlyBudgetCents: budgetCents })
  })
