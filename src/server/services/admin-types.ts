import type { Purchase } from '../../domain/types'
import type {
  AdminCategoryRecord,
  AdminProductRecord,
  AdminPurchaseRecord,
  AdminUserRecord,
  Cart,
  ShoppingList,
} from '../db/models'

export interface PageFilter {
  search?: string
  page?: number
  pageSize?: number
}

export interface ListResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AdminOverview {
  counts: {
    users: number
    stores: number
    products: number
    categories: number
    purchases: number
  }
  gmvCents: number
  recentPurchases: AdminPurchaseRecord[]
}

export interface AdminProductList extends ListResult<AdminProductRecord> {
  categories: AdminCategoryRecord[]
}

export interface AdminUserDetail {
  user: AdminUserRecord
  lists: ShoppingList[]
  carts: Cart[]
  purchases: Purchase[]
}
