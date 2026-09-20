import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '../auth/session'
import type { NewCartLine } from '../db/models'
import { addLine } from '../services/cart-service'
import { lookupBarcode, searchProducts } from '../services/scanner-service'

export const lookupProduct = createServerFn({ method: 'GET' })
  .validator((data: { barcode: string; storeId?: string }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return lookupBarcode(repo, user.id, data.barcode, data.storeId)
  })

export const searchCatalog = createServerFn({ method: 'GET' })
  .validator((data: { query: string }) => data)
  .handler(async ({ data }) => {
    const { repo } = await requireSession()
    return searchProducts(repo, data.query)
  })

export const scanProduct = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string; line: NewCartLine }) => data)
  .handler(async ({ data }) => {
    const { repo, user } = await requireSession()
    return addLine(repo, user.id, data.cartId, data.line)
  })
