import { createServerFn } from '@tanstack/react-start'
import { getRepo } from '../db/runtime'
import {
  getHistory,
  getMonthSummary,
  getPurchaseSummary,
  listAvailableMonths,
} from '../services/history-service'

export const fetchMonths = createServerFn({ method: 'GET' }).handler(() =>
  listAvailableMonths(getRepo()),
)

export const fetchHistory = createServerFn({ method: 'GET' })
  .validator((data: { year: number; month: number }) => data)
  .handler(({ data }) => getHistory(getRepo(), data.year, data.month))

export const fetchMonthSummary = createServerFn({ method: 'GET' })
  .validator((data: { year?: number; month?: number }) => data)
  .handler(({ data }) => {
    const repo = getRepo()
    const months = listAvailableMonths(repo)
    const target =
      months.find((month) => month.year === data.year && month.month === data.month) ?? months[0]
    if (!target) return null
    return getMonthSummary(repo, target.year, target.month)
  })

export const fetchPurchaseSummary = createServerFn({ method: 'GET' })
  .validator((data: { purchaseId: string }) => data)
  .handler(({ data }) => getPurchaseSummary(getRepo(), data.purchaseId))
