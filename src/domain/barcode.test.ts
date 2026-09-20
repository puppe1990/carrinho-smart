import { describe, expect, it } from 'vitest'
import {
  buildEan13,
  classifyBarcode,
  ean13CheckDigit,
  isValidEan13,
  normalizeBarcode,
} from './barcode'

describe('ean13CheckDigit', () => {
  it('computes the check digit for known EAN-13 codes', () => {
    expect(ean13CheckDigit('789100000000')).toBe(7)
    expect(ean13CheckDigit('400638133393')).toBe(1)
  })

  it('rejects prefixes that are not 12 digits', () => {
    expect(() => ean13CheckDigit('123')).toThrow()
  })
})

describe('buildEan13', () => {
  it('appends a valid check digit', () => {
    expect(buildEan13('789100000001')).toBe('7891000000014')
    expect(isValidEan13(buildEan13('789100000042'))).toBe(true)
    expect(isValidEan13(buildEan13('789100000001'))).toBe(true)
  })

  it('ignores non numeric characters', () => {
    expect(buildEan13('789-100-000-001')).toBe('7891000000014')
  })

  it('rejects invalid prefixes', () => {
    expect(() => buildEan13('123')).toThrow()
  })
})

describe('isValidEan13', () => {
  it('accepts a well-formed barcode', () => {
    expect(isValidEan13('4006381333931')).toBe(true)
    expect(isValidEan13('7891000000014')).toBe(true)
  })

  it('rejects wrong check digit, length or non digits', () => {
    expect(isValidEan13('7891000000001')).toBe(false)
    expect(isValidEan13('7891000000004')).toBe(false)
    expect(isValidEan13('12345678901')).toBe(false)
    expect(isValidEan13('78910000000ab')).toBe(false)
  })
})

describe('classifyBarcode', () => {
  it('identifies known formats', () => {
    expect(classifyBarcode('7891000000017')).toBe('code128')
    expect(classifyBarcode('7891000000014')).toBe('ean13')
    expect(classifyBarcode('12345678')).toBe('ean8')
    expect(classifyBarcode('012345678905')).toBe('upc')
    expect(classifyBarcode('12345678901234')).toBe('itf')
    expect(classifyBarcode('ABC-123')).toBe('code128')
    expect(classifyBarcode('   ')).toBe('unknown')
  })
})

describe('normalizeBarcode', () => {
  it('strips spaces and punctuation', () => {
    expect(normalizeBarcode(' 789 100.000-0017 ')).toBe('7891000000017')
  })

  it('keeps letters for alphanumeric symbologies', () => {
    expect(normalizeBarcode('  ABC-123  ')).toBe('ABC123')
  })
})
