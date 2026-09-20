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

function resolveStore(repo: Repository, userId: string, storeId?: string): Store {
  if (storeId) {
    const requested = repo.stores.get(storeId)
    if (requested) return requested
  }

  const activeCart = repo.carts.getLatestActive(userId)
  if (activeCart) {
    const cartStore = repo.stores.get(activeCart.storeId)
    if (cartStore) return cartStore
  }

  const fallback = repo.stores.list()[0]
  if (!fallback) throw new Error('Nenhuma loja cadastrada. Rode o seed do banco de dados.')
  return fallback
}

function requireCart(repo: Repository, cartId: string, userId: string): Cart {
  const cart = repo.carts.get(cartId, userId)
  if (!cart) throw new Error('Carrinho não encontrado para este usuário')
  return cart
}

export function getCartOverview(repo: Repository, userId: string, storeId?: string): CartOverview {
  const store = resolveStore(repo, userId, storeId)
  const cart = repo.carts.getOrCreateActive({ userId, storeId: store.id, budgetCents: 35000 })
  const lines = repo.carts.listLines(cart.id)
  const summary = cartSummary(lines)

  const list = cart.listId ? repo.lists.get(cart.listId) : repo.lists.getActive(userId)
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

export function setBudget(
  repo: Repository,
  userId: string,
  cartId: string,
  budgetCents: number,
): Cart {
  requireCart(repo, cartId, userId)
  return repo.carts.updateBudget(cartId, userId, budgetCents)
}

export function mutate(repo: Repository, cartId: string): CartMutationResult {
  const summary = repo.carts.summary(cartId)
  const cart = repo.carts.get(cartId)
  return { summary, budget: budgetStatus(summary.totalCents, cart?.budgetCents ?? 0) }
}

export function addLine(
  repo: Repository,
  userId: string,
  cartId: string,
  input: NewCartLine,
): { line: CartLine } & CartMutationResult {
  requireCart(repo, cartId, userId)
  const line = repo.carts.addLine(cartId, input)
  return { line, ...mutate(repo, cartId) }
}

export function updateLineQuantity(
  repo: Repository,
  userId: string,
  lineId: string,
  quantity: number,
): { line: CartLine } & CartMutationResult {
  const cartId = repo.carts.cartIdForLine(lineId)
  if (!cartId) throw new Error('Item do carrinho não encontrado')
  requireCart(repo, cartId, userId)
  const line = repo.carts.updateQuantity(lineId, quantity)
  return { line, ...mutate(repo, cartId) }
}

export function removeLine(repo: Repository, userId: string, lineId: string): CartSummary {
  const cartId = repo.carts.cartIdForLine(lineId)
  if (!cartId) throw new Error('Item do carrinho não encontrado')
  requireCart(repo, cartId, userId)
  repo.carts.removeLine(lineId)
  return repo.carts.summary(cartId)
}

export function clearCart(repo: Repository, userId: string, cartId: string): CartSummary {
  requireCart(repo, cartId, userId)
  repo.carts.clear(cartId)
  return repo.carts.summary(cartId)
}

export function checkout(repo: Repository, userId: string, cartId: string): Purchase {
  requireCart(repo, cartId, userId)
  return repo.carts.checkout(cartId)
}
