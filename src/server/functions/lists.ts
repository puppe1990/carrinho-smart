import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '../auth/session'
import {
  addQuickItem,
  getShoppingListOverview,
  removeListItem,
  resetListItem,
  scanListItem,
} from '../services/list-service'

export const fetchShoppingList = createServerFn({ method: 'GET' }).handler(async () => {
  const { repo, user } = await requireSession()
  return getShoppingListOverview(repo, user.id)
})

export const createQuickItem = createServerFn({ method: 'POST' })
  .validator((data: { listId: string; name: string }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return addQuickItem(repo, user.id, data.listId, data.name)
  })

export const removeListItemFn = createServerFn({ method: 'POST' })
  .validator((data: { itemId: string }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return removeListItem(repo, user.id, data.itemId)
  })

export const scanListItemFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      itemId: string
      cartId: string
      unitPriceCents: number
      quantity?: number
      promo?: boolean
    }) => data,
  )
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return scanListItem(repo, user.id, data.itemId, {
      cartId: data.cartId,
      unitPriceCents: data.unitPriceCents,
      quantity: data.quantity,
      promo: data.promo,
    })
  })

export const resetListItemFn = createServerFn({ method: 'POST' })
  .validator((data: { itemId: string }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return resetListItem(repo, user.id, data.itemId)
  })
