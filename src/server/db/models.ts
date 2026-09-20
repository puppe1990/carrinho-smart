import type { Unit } from '../../domain/types'

export type { Unit }

export interface Category {
  id: string
  name: string
  icon: string
  color: string
}

export interface Store {
  id: string
  name: string
  city: string | null
}

export interface Product {
  id: string
  barcode: string
  name: string
  brand: string | null
  categoryId: string
  unit: Unit
  priceCents: number
  imageUrl: string | null
  aisle: string | null
}

export interface ShoppingList {
  id: string
  userId: string
  name: string
  shoppingDate: string
  budgetCents: number
  status: string
}

export interface Cart {
  id: string
  userId: string
  storeId: string
  listId: string | null
  budgetCents: number
  status: string
  createdAt: string
}

export interface PurchaseItem {
  id: string
  purchaseId: string
  productId: string | null
  name: string
  categoryId: string
  unitPriceCents: number
  quantity: number
  totalCents: number
  wasPromo: boolean
}

export interface PriceEntry {
  id: string
  productId: string
  storeId: string | null
  priceCents: number
  recordedAt: string
}

export interface NewCartLine {
  productId?: string | null
  listItemId?: string | null
  barcode?: string | null
  name: string
  brand?: string | null
  categoryId: string
  imageUrl?: string | null
  unit?: Unit
  unitPriceCents: number
  listPriceCents?: number
  quantity?: number
  promo?: boolean
  isWeighed?: boolean
}

export interface NewListItem {
  productId?: string | null
  name: string
  categoryId?: string | null
  aisle?: string | null
  expectedPriceCents?: number
  quantity?: number
}

export interface NewPurchase {
  id?: string
  userId: string
  storeId: string
  listId?: string | null
  budgetCents: number
  totalCents: number
  savingsCents: number
  itemCount: number
  purchasedAt: string
}

export interface NewPurchaseItem {
  productId?: string | null
  name: string
  categoryId: string
  unitPriceCents: number
  quantity: number
  totalCents: number
  wasPromo: boolean
}

export interface AdminCategoryRecord extends Category {
  productCount: number
}

export interface AdminStoreRecord extends Store {
  usageCount: number
}

export interface AdminProductRecord {
  id: string
  barcode: string
  name: string
  brand: string | null
  categoryId: string
  categoryName: string
  unit: Unit
  priceCents: number
  imageUrl: string | null
  aisle: string | null
  usageCount: number
}

export interface AdminUserRecord {
  id: string
  name: string
  email: string
  createdAt: string
  listCount: number
  cartCount: number
  purchaseCount: number
  totalSpentCents: number
}

export interface AdminPurchaseRecord {
  id: string
  userId: string
  userName: string
  storeId: string
  storeName: string
  totalCents: number
  itemCount: number
  purchasedAt: string
}
