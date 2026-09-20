import { roundCents } from './money'
import type { CartLine, ListItem } from './types'

export interface CartSummary {
  kindCount: number
  unitCount: number
  totalCents: number
  savingsCents: number
}

export function lineTotalCents(line: Pick<CartLine, 'unitPriceCents' | 'quantity'>): number {
  return roundCents(line.unitPriceCents * line.quantity)
}

export function lineSavingsCents(
  line: Pick<CartLine, 'unitPriceCents' | 'listPriceCents' | 'quantity'>,
): number {
  const discount = line.listPriceCents - line.unitPriceCents
  if (discount <= 0) return 0
  return roundCents(discount * line.quantity)
}

export function cartSummary(lines: CartLine[]): CartSummary {
  return lines.reduce<CartSummary>(
    (summary, line) => ({
      kindCount: summary.kindCount + 1,
      unitCount: summary.unitCount + line.quantity,
      totalCents: summary.totalCents + lineTotalCents(line),
      savingsCents: summary.savingsCents + lineSavingsCents(line),
    }),
    { kindCount: 0, unitCount: 0, totalCents: 0, savingsCents: 0 },
  )
}

export function changedQuantity(current: number, delta: number, min = 1): number {
  return Math.max(min, current + delta)
}

export function detectExtraItems(list: ListItem[], cart: CartLine[]): CartLine[] {
  const plannedIds = new Set(list.map((item) => item.id))
  return cart.filter((line) => !line.listItemId || !plannedIds.has(line.listItemId))
}
