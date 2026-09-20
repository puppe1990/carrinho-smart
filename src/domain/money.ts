import type { Unit } from './types'

export function roundCents(value: number): number {
  return Math.round(value)
}

export function formatBRL(cents: number): string {
  const rounded = Math.round(cents)
  const negative = rounded < 0
  const abs = Math.abs(rounded)
  const reais = Math.floor(abs / 100)
  const centavos = abs % 100
  const reaisLabel = reais.toLocaleString('en-US').replace(/,/g, '.')
  return `${negative ? '-' : ''}R$ ${reaisLabel},${String(centavos).padStart(2, '0')}`
}

export function parseBRL(input: string | number): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : 0
  }
  if (!input) return 0

  const cleaned = String(input).replace(/[^\d.,-]/g, '')
  if (!cleaned) return 0

  const negative = cleaned.startsWith('-')
  const unsigned = cleaned.replace(/-/g, '')
  const normalized = unsigned.includes(',')
    ? unsigned.replace(/\./g, '').replace(',', '.')
    : unsigned

  const value = Number.parseFloat(normalized)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) * (negative ? -1 : 1)
}

export function formatQuantity(quantity: number, unit: Unit): string {
  if (unit === 'kg') {
    const value = quantity.toLocaleString('pt-BR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
    return `${value} kg`
  }
  if (unit === 'L') {
    const value = quantity.toLocaleString('pt-BR', {
      maximumFractionDigits: 2,
    })
    return `${value} L`
  }
  return `${Math.round(quantity)} un`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}
