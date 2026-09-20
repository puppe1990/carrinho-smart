import { createServerFn } from '@tanstack/react-start'
import { getRepo } from '../db/runtime'
import {
  addQuickItem,
  getShoppingListOverview,
  removeListItem,
  resetListItem,
  scanListItem,
} from '../services/list-service'

export const fetchShoppingList = createServerFn({ method: 'GET' }).handler(() =>
  getShoppingListOverview(getRepo()),
)

export const createQuickItem = createServerFn({ method: 'POST' })
  .validator((data: { listId: string; name: string }) => data)
  .handler(({ data }) => addQuickItem(getRepo(), data.listId, data.name))

export const removeListItemFn = createServerFn({ method: 'POST' })
  .validator((data: { itemId: string }) => data)
  .handler(({ data }) => removeListItem(getRepo(), data.itemId))

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
  .handler(({ data }) =>
    scanListItem(getRepo(), data.itemId, {
      cartId: data.cartId,
      unitPriceCents: data.unitPriceCents,
      quantity: data.quantity,
      promo: data.promo,
    }),
  )

export const resetListItemFn = createServerFn({ method: 'POST' })
  .validator((data: { itemId: string }) => data)
  .handler(({ data }) => resetListItem(getRepo(), data.itemId))
