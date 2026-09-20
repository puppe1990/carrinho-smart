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

function requireOwnedList(repo: Repository, userId: string, listId: string): ShoppingList {
  const list = repo.lists.get(listId)
  if (!list || list.userId !== userId) throw new Error('Lista não encontrada para este usuário')
  return list
}

function requireOwnedItem(
  repo: Repository,
  userId: string,
  itemId: string,
): { item: ListItem; listId: string } {
  const item = repo.lists.getItem(itemId)
  const listId = repo.lists.listIdForItem(itemId)
  if (!item || !listId) throw new Error('Item da lista não encontrado')
  requireOwnedList(repo, userId, listId)
  return { item, listId }
}

export function getShoppingListOverview(repo: Repository, userId: string): ShoppingListOverview {
  const list = repo.lists.getActive(userId)
  if (!list) return { list: null, items: [], progress: EMPTY_PROGRESS }
  const items = repo.lists.listItems(list.id)
  return { list, items, progress: listProgress(items) }
}

export function addQuickItem(
  repo: Repository,
  userId: string,
  listId: string,
  name: string,
): ListItem {
  requireOwnedList(repo, userId, listId)
  const draft = quickAddItem(name)
  return repo.lists.addItem(listId, { name: draft.name })
}

export function removeListItem(repo: Repository, userId: string, itemId: string): ListProgress {
  const { listId } = requireOwnedItem(repo, userId, itemId)
  repo.lists.removeItem(itemId)
  return repo.lists.progress(listId)
}

export function scanListItem(
  repo: Repository,
  userId: string,
  itemId: string,
  input: { cartId: string; unitPriceCents: number; quantity?: number; promo?: boolean },
): { line: CartLine; item: ListItem; progress: ListProgress } {
  const { item, listId } = requireOwnedItem(repo, userId, itemId)

  const cart = repo.carts.get(input.cartId, userId)
  if (!cart) throw new Error('Carrinho não encontrado para este usuário')

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

  return { line, item: updated, progress: repo.lists.progress(listId) }
}

export function resetListItem(repo: Repository, userId: string, itemId: string): ListItem {
  requireOwnedItem(repo, userId, itemId)
  return repo.lists.setStatus(itemId, 'pending', null)
}
