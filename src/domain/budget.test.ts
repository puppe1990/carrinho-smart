import { describe, expect, it } from 'vitest'
import { budgetGauge, budgetLevel, budgetStatus } from './budget'

describe('budgetLevel', () => {
  it('is safe below 80%', () => {
    expect(budgetLevel(0)).toBe('safe')
    expect(budgetLevel(79)).toBe('safe')
  })

  it('warns from 80% up to the limit', () => {
    expect(budgetLevel(80)).toBe('warning')
    expect(budgetLevel(100)).toBe('warning')
  })

  it('is over above the limit', () => {
    expect(budgetLevel(101)).toBe('over')
  })
})

describe('budgetStatus', () => {
  it('reports a comfortable cart', () => {
    const status = budgetStatus(26480, 35000)
    expect(status.percent).toBe(76)
    expect(status.level).toBe('safe')
    expect(status.isOver).toBe(false)
    expect(status.remainingCents).toBe(8520)
  })

  it('warns exactly at the 80% threshold', () => {
    const status = budgetStatus(28000, 35000)
    expect(status.percent).toBe(80)
    expect(status.level).toBe('warning')
  })

  it('flags an over-budget cart and never reports negative remaining', () => {
    const status = budgetStatus(36480, 35000)
    expect(status.percent).toBe(104)
    expect(status.level).toBe('over')
    expect(status.isOver).toBe(true)
    expect(status.remainingCents).toBe(0)
  })

  it('degrades gracefully with a zero or negative limit', () => {
    expect(budgetStatus(1000, 0).percent).toBe(0)
    expect(budgetStatus(1000, -10).level).toBe('over')
  })
})

describe('budgetGauge', () => {
  it('splits the gauge into a base and a new-item segment', () => {
    const gauge = budgetGauge(26480, 3890, 35000)
    expect(gauge.basePercent).toBe(76)
    expect(gauge.totalPercent).toBe(87)
    expect(gauge.deltaPercent).toBe(11)
    expect(gauge.over).toBe(false)
    expect(gauge.level).toBe('warning')
  })

  it('marks the gauge as over when the new item pushes past the limit', () => {
    const gauge = budgetGauge(26480, 10000, 35000)
    expect(gauge.totalPercent).toBe(104)
    expect(gauge.deltaPercent).toBe(28)
    expect(gauge.over).toBe(true)
    expect(gauge.level).toBe('over')
    expect(gauge.basePercent).toBe(76)
  })

  it('never returns a negative delta', () => {
    expect(budgetGauge(30000, 0, 35000).deltaPercent).toBe(0)
  })
})
