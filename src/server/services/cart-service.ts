import { budgetStatus, type BudgetStatus } from '../../domain/budget'
import { cartSummary, detectExtraItems, lineTotalCents, type CartSummary } from '../../domain/cart'
import type { ListProgress } from '../../domain/shopping-list'
import type { CartLine, Purchase } from '../../domain/types'
import type { Cart, Category, NewCartLine, Store } from '../db/models'
import type { Repository } from '../db/repositories'

export interface CartOverview {
  store: Store | null
  stores: Store[]
  categories: Category[]
  cart: Cart
  lines: CartLine[]
  summary: CartSummary
  budget: BudgetStatus
  extraItems: CartLine[]
  tip: { extraCount: number; extraImpactCents: number; nextPendingName: string | null }
  listId: string | null
  listName: string | null
  listProgress: ListProgress | null
}

export interface CartMutationResult {
  summary: CartSummary
  budget: BudgetStatus
}

function resolveStore(repo: Repository, storeId?: string): Store {
  const store = (storeId ? repo.stores.get(storeId) : null) ?? repo.stores.list()[0]
  if (!store) throw new Error('Nenhuma loja cadastrada. Rode o seed do banco de dados.')
  return store
}

export function getCartOverview(repo: Repository, storeId?: string): CartOverview {
  const store = resolveStore(repo, storeId)
  const cart = repo.carts.getOrCreateActive({ storeId: store.id, budgetCents: 35000 })
  const lines = repo.carts.listLines(cart.id)
  const summary = cartSummary(lines)

  const list = cart.listId ? repo.lists.get(cart.listId) : repo.lists.getActive()
  const listItems = list ? repo.lists.listItems(list.id) : []
  const extraItems = detectExtraItems(listItems, lines)
  const nextPendingName = listItems.find((item) => item.status === 'pending')?.name ?? null

  return {
    store,
    stores: repo.stores.list(),
    categories: repo.categories.list(),
    cart,
    lines,
    summary,
    budget: budgetStatus(summary.totalCents, cart.budgetCents),
    extraItems,
    tip: {
      extraCount: extraItems.length,
      extraImpactCents: extraItems.reduce((sum, line) => sum + lineTotalCents(line), 0),
      nextPendingName,
    },
    listId: list?.id ?? null,
    listName: list?.name ?? null,
    listProgress: list ? repo.lists.progress(list.id) : null,
  }
}

export function setBudget(repo: Repository, cartId: string, budgetCents: number): Cart {
  return repo.carts.updateBudget(cartId, budgetCents)
}

export function mutate(repo: Repository, cartId: string): CartMutationResult {
  const summary = repo.carts.summary(cartId)
  const cart = repo.carts.get(cartId)
  return { summary, budget: budgetStatus(summary.totalCents, cart?.budgetCents ?? 0) }
}

export function addLine(
  repo: Repository,
  cartId: string,
  input: NewCartLine,
): { line: CartLine } & CartMutationResult {
  const line = repo.carts.addLine(cartId, input)
  return { line, ...mutate(repo, cartId) }
}

export function updateLineQuantity(
  repo: Repository,
  lineId: string,
  quantity: number,
): { line: CartLine } & CartMutationResult {
  const cartId = repo.carts.cartIdForLine(lineId) ?? ''
  const line = repo.carts.updateQuantity(lineId, quantity)
  return { line, ...mutate(repo, cartId) }
}

export function removeLine(repo: Repository, lineId: string): CartSummary {
  const cartId = repo.carts.cartIdForLine(lineId)
  repo.carts.removeLine(lineId)
  return cartId
    ? repo.carts.summary(cartId)
    : { kindCount: 0, unitCount: 0, totalCents: 0, savingsCents: 0 }
}

export function clearCart(repo: Repository, cartId: string): CartSummary {
  repo.carts.clear(cartId)
  return repo.carts.summary(cartId)
}

export function checkout(repo: Repository, cartId: string): Purchase {
  return repo.carts.checkout(cartId)
}
