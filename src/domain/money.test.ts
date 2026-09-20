import { describe, expect, it } from 'vitest'
import { formatBRL, formatPercent, formatQuantity, parseBRL, roundCents } from './money'

describe('roundCents', () => {
  it('rounds to the nearest cent', () => {
    expect(roundCents(1013.55)).toBe(1014)
    expect(roundCents(1013.44)).toBe(1013)
    expect(roundCents(2500)).toBe(2500)
  })
})

describe('formatBRL', () => {
  it('formats whole and fractional values with pt-BR separators', () => {
    expect(formatBRL(26480)).toBe('R$ 264,80')
    expect(formatBRL(105320)).toBe('R$ 1.053,20')
    expect(formatBRL(0)).toBe('R$ 0,00')
    expect(formatBRL(5)).toBe('R$ 0,05')
  })

  it('places the minus sign before the currency symbol', () => {
    expect(formatBRL(-1234)).toBe('-R$ 12,34')
  })
})

describe('parseBRL', () => {
  it('parses comma decimals', () => {
    expect(parseBRL('38,90')).toBe(3890)
  })

  it('parses thousands with dot groups and comma decimals', () => {
    expect(parseBRL('1.234,56')).toBe(123456)
  })

  it('parses dot decimals when there is no comma', () => {
    expect(parseBRL('38.90')).toBe(3890)
    expect(parseBRL('5.49')).toBe(549)
  })

  it('accepts numbers and blank input', () => {
    expect(parseBRL(12.5)).toBe(1250)
    expect(parseBRL('')).toBe(0)
    expect(parseBRL('R$ abc')).toBe(0)
  })
})

describe('formatQuantity', () => {
  it('formats unit counts', () => {
    expect(formatQuantity(2, 'un')).toBe('2 un')
    expect(formatQuantity(1, 'un')).toBe('1 un')
  })

  it('formats weighted amounts with three decimals', () => {
    expect(formatQuantity(1.45, 'kg')).toBe('1,450 kg')
    expect(formatQuantity(0.5, 'kg')).toBe('0,500 kg')
  })

  it('formats liters with up to two decimals', () => {
    expect(formatQuantity(1.5, 'L')).toBe('1,5 L')
    expect(formatQuantity(3, 'L')).toBe('3 L')
  })
})

describe('formatPercent', () => {
  it('renders an integer percentage', () => {
    expect(formatPercent(76)).toBe('76%')
    expect(formatPercent(103)).toBe('103%')
  })
})
