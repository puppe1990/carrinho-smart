import { createServerFn } from '@tanstack/react-start'
import { getRepo } from '../db/runtime'
import {
  addLine,
  checkout,
  clearCart,
  getCartOverview,
  removeLine,
  setBudget,
  updateLineQuantity,
} from '../services/cart-service'
import type { NewCartLine } from '../db/models'

export const fetchCartOverview = createServerFn({ method: 'GET' })
  .validator((data: { storeId?: string } | undefined) => data ?? {})
  .handler(({ data }) => getCartOverview(getRepo(), data.storeId))

export const changeBudget = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string; budgetCents: number }) => data)
  .handler(({ data }) => setBudget(getRepo(), data.cartId, data.budgetCents))

export const addCartItem = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string; line: NewCartLine }) => data)
  .handler(({ data }) => addLine(getRepo(), data.cartId, data.line))

export const changeCartItemQuantity = createServerFn({ method: 'POST' })
  .validator((data: { lineId: string; quantity: number }) => data)
  .handler(({ data }) => updateLineQuantity(getRepo(), data.lineId, data.quantity))

export const deleteCartItem = createServerFn({ method: 'POST' })
  .validator((data: { lineId: string }) => data)
  .handler(({ data }) => removeLine(getRepo(), data.lineId))

export const emptyCart = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string }) => data)
  .handler(({ data }) => clearCart(getRepo(), data.cartId))

export const finishCart = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string }) => data)
  .handler(({ data }) => checkout(getRepo(), data.cartId))
