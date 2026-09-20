export type Unit = 'un' | 'kg' | 'L'

export type BudgetLevel = 'safe' | 'warning' | 'over'

export type ListItemStatus = 'pending' | 'scanned'

export interface CartLine {
  id: string
  productId: string | null
  listItemId: string | null
  name: string
  categoryId: string
  unit: Unit
  unitPriceCents: number
  listPriceCents: number
  quantity: number
  promo: boolean
  isWeighed: boolean
}

export interface ListItem {
  id: string
  name: string
  categoryId: string | null
  aisle: string | null
  expectedPriceCents: number
  status: ListItemStatus
  quantity: number
  scannedPriceCents: number | null
  productId: string | null
}

export interface Purchase {
  id: string
  storeId: string
  storeName: string
  listId: string | null
  budgetCents: number
  totalCents: number
  savingsCents: number
  itemCount: number
  purchasedAt: string
}
