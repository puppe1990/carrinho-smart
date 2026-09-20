import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '../auth/session'
import type { NewCartLine } from '../db/models'
import {
  addLine,
  checkout,
  clearCart,
  getCartOverview,
  removeLine,
  setBudget,
  updateLineQuantity,
} from '../services/cart-service'

export const fetchCartOverview = createServerFn({ method: 'GET' })
  .validator((data: { storeId?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return getCartOverview(repo, user.id, data.storeId)
  })

export const changeBudget = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string; budgetCents: number }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return setBudget(repo, user.id, data.cartId, data.budgetCents)
  })

export const addCartItem = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string; line: NewCartLine }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return addLine(repo, user.id, data.cartId, data.line)
  })

export const changeCartItemQuantity = createServerFn({ method: 'POST' })
  .validator((data: { lineId: string; quantity: number }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return updateLineQuantity(repo, user.id, data.lineId, data.quantity)
  })

export const deleteCartItem = createServerFn({ method: 'POST' })
  .validator((data: { lineId: string }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return removeLine(repo, user.id, data.lineId)
  })

export const emptyCart = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return clearCart(repo, user.id, data.cartId)
  })

export const finishCart = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return checkout(repo, user.id, data.cartId)
  })
