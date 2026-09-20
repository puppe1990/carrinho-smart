import { priceTrend, type PriceTrend } from '../../domain/analytics'
import type { Product } from '../db/models'
import type { Repository } from '../db/repositories'

export interface BarcodeLookup {
  product: Product
  previousPriceCents: number
  previousRecordedAt: string | null
  suggestedPriceCents: number
  trend: PriceTrend
}

export function lookupBarcode(
  repo: Repository,
  barcode: string,
  storeId?: string,
): BarcodeLookup | null {
  const product = repo.products.findByBarcode(barcode)
  if (!product) return null

  const last = repo.priceHistory.lastForProduct(product.id, storeId)
  const previousPriceCents = last?.priceCents ?? product.priceCents
  const suggestedPriceCents = product.priceCents

  return {
    product,
    previousPriceCents,
    previousRecordedAt: last?.recordedAt ?? null,
    suggestedPriceCents,
    trend: priceTrend(suggestedPriceCents, previousPriceCents),
  }
}

export function searchProducts(repo: Repository, query: string): Product[] {
  const term = query.trim()
  if (!term) return repo.products.list()
  return repo.products.search(term)
}

export function getProduct(repo: Repository, productId: string): Product | null {
  return repo.products.get(productId)
}
