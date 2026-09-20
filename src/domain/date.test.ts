import { describe, expect, it } from 'vitest'
import { formatDate } from './date'

describe('formatDate', () => {
  it('formata uma data ISO em pt-BR', () => {
    expect(formatDate('2026-09-01T10:00:00.000Z')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('retorna travessão para vazio ou inválido', () => {
    expect(formatDate('')).toBe('—')
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('não é data')).toBe('—')
  })
})
