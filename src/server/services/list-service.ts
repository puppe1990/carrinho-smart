import { roundCents } from '../../domain/money'
import { listProgress, quickAddItem, type ListProgress } from '../../domain/shopping-list'
import type { CartLine, ListItem } from '../../domain/types'
import type { ShoppingList } from '../db/models'
import type { Repository } from '../db/repositories'

export interface ShoppingListOverview {
  list: ShoppingList | null
  items: ListItem[]
  progress: ListProgress
}

const EMPTY_PROGRESS: ListProgress = {
  total: 0,
  scannedCount: 0,
  pendingCount: 0,
  remainingCount: 0,
  percentScanned: 0,
  expectedTotalCents: 0,
  scannedTotalCents: 0,
}

export function getShoppingListOverview(repo: Repository): ShoppingListOverview {
  const list = repo.lists.getActive()
  if (!list) return { list: null, items: [], progress: EMPTY_PROGRESS }
  const items = repo.lists.listItems(list.id)
  return { list, items, progress: listProgress(items) }
}

export function addQuickItem(repo: Repository, listId: string, name: string): ListItem {
  const draft = quickAddItem(name)
  return repo.lists.addItem(listId, { name: draft.name })
}

export function removeListItem(repo: Repository, itemId: string): ListProgress {
  const listId = repo.lists.listIdForItem(itemId)
  repo.lists.removeItem(itemId)
  return listId ? repo.lists.progress(listId) : EMPTY_PROGRESS
}

export function scanListItem(
  repo: Repository,
  itemId: string,
  input: { cartId: string; unitPriceCents: number; quantity?: number; promo?: boolean },
): { line: CartLine; item: ListItem; progress: ListProgress } {
  const item = repo.lists.getItem(itemId)
  if (!item) throw new Error('Item da lista não encontrado')

  const product = item.productId ? repo.products.get(item.productId) : null
  const quantity = input.quantity ?? 1
  const line = repo.carts.addLine(input.cartId, {
    productId: item.productId,
    listItemId: item.id,
    name: item.name,
    brand: product?.brand ?? null,
    categoryId: item.categoryId ?? 'outros',
    unit: product?.unit ?? 'un',
    unitPriceCents: input.unitPriceCents,
    listPriceCents: input.unitPriceCents,
    quantity,
    promo: input.promo ?? false,
    isWeighed: (product?.unit ?? 'un') === 'kg',
  })

  const updated = repo.lists.setStatus(
    item.id,
    'scanned',
    roundCents(input.unitPriceCents * quantity),
  )
  const listId = repo.lists.listIdForItem(item.id)
  return {
    line,
    item: updated,
    progress: listId ? repo.lists.progress(listId) : EMPTY_PROGRESS,
  }
}

export function resetListItem(repo: Repository, itemId: string): ListItem {
  return repo.lists.setStatus(itemId, 'pending', null)
}
