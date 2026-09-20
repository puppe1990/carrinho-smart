/** Utilitários de código de barras (EAN-13 / GTIN). */

export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  let sum = 0
  for (let index = 0; index < 12; index += 1) {
    sum += Number(code[index]) * (index % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10 === Number(code[12])
}

export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) throw new Error('EAN-13 requer 12 dígitos iniciais')
  let sum = 0
  for (let index = 0; index < 12; index += 1) {
    sum += Number(first12[index]) * (index % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

/** Gera um EAN-13 válido a partir de um prefixo numérico. */
export function buildEan13(prefix: string): string {
  const digits = prefix.replace(/\D/g, '')
  if (digits.length !== 12) throw new Error('Prefixo deve ter 12 dígitos')
  return `${digits}${ean13CheckDigit(digits)}`
}

export type BarcodeFormat = 'ean13' | 'ean8' | 'upc' | 'code128' | 'itf' | 'unknown'

export function classifyBarcode(code: string): BarcodeFormat {
  const digits = code.replace(/\D/g, '')
  if (digits.length === 13 && isValidEan13(digits)) return 'ean13'
  if (digits.length === 8) return 'ean8'
  if (digits.length === 12) return 'upc'
  if (digits.length === 14) return 'itf'
  if (code.trim().length > 0) return 'code128'
  return 'unknown'
}

export function normalizeBarcode(raw: string): string {
  const trimmed = raw.trim()
  if (!/\d/.test(trimmed)) return trimmed
  return trimmed.replace(/[^\dA-Za-z]/g, '')
}
