import type { BudgetLevel } from './types'

export interface BudgetStatus {
  limitCents: number
  spentCents: number
  remainingCents: number
  percent: number
  level: BudgetLevel
  isOver: boolean
}

export interface BudgetGauge {
  basePercent: number
  deltaPercent: number
  totalPercent: number
  over: boolean
  level: BudgetLevel
}

const WARNING_THRESHOLD = 80

export function budgetLevel(percent: number): BudgetLevel {
  if (percent > 100) return 'over'
  if (percent >= WARNING_THRESHOLD) return 'warning'
  return 'safe'
}

export function budgetStatus(spentCents: number, limitCents: number): BudgetStatus {
  if (limitCents <= 0) {
    return {
      limitCents: Math.max(0, limitCents),
      spentCents,
      remainingCents: 0,
      percent: 0,
      level: spentCents > 0 ? 'over' : 'safe',
      isOver: spentCents > 0,
    }
  }

  const percent = Math.round((spentCents / limitCents) * 100)
  const isOver = spentCents > limitCents

  return {
    limitCents,
    spentCents,
    remainingCents: Math.max(0, limitCents - spentCents),
    percent,
    level: budgetLevel(percent),
    isOver,
  }
}

export function budgetGauge(
  baseCents: number,
  addedCents: number,
  limitCents: number,
): BudgetGauge {
  if (limitCents <= 0) {
    const total = baseCents + addedCents
    return {
      basePercent: 0,
      deltaPercent: 0,
      totalPercent: 0,
      over: total > 0,
      level: total > 0 ? 'over' : 'safe',
    }
  }

  const basePercent = Math.round((baseCents / limitCents) * 100)
  const totalCents = baseCents + addedCents
  const totalPercent = Math.round((totalCents / limitCents) * 100)

  return {
    basePercent,
    deltaPercent: Math.max(0, totalPercent - basePercent),
    totalPercent,
    over: totalCents > limitCents,
    level: budgetLevel(totalPercent),
  }
}
