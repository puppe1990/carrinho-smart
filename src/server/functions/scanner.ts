import { createServerFn } from '@tanstack/react-start'
import { getRepo } from '../db/runtime'
import { lookupBarcode, searchProducts } from '../services/scanner-service'
import { addLine } from '../services/cart-service'
import type { NewCartLine } from '../db/models'

export const lookupProduct = createServerFn({ method: 'GET' })
  .validator((data: { barcode: string; storeId?: string }) => data)
  .handler(({ data }) => lookupBarcode(getRepo(), data.barcode, data.storeId))

export const searchCatalog = createServerFn({ method: 'GET' })
  .validator((data: { query: string }) => data)
  .handler(({ data }) => searchProducts(getRepo(), data.query))

export const scanProduct = createServerFn({ method: 'POST' })
  .validator((data: { cartId: string; line: NewCartLine }) => data)
  .handler(({ data }) => addLine(getRepo(), data.cartId, data.line))
