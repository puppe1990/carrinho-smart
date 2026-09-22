import { describe, expect, it } from 'vitest'
import { receiptFilename } from './receipt-image'

describe('receiptFilename', () => {
  it('gera um nome de arquivo a partir da loja e da data', () => {
    expect(
      receiptFilename({
        purchaseId: 'p1',
        storeName: 'Atacadão Tatuapé',
        purchasedAt: '2026-09-21T17:36:52.000Z',
        items: [],
        totalCents: 0,
        savingsCents: 0,
      }),
    ).toBe('recibo-atacadao-tatuape-2026-09-21.png')
  })

  it('usa fallback quando a loja não gera slug', () => {
    expect(
      receiptFilename({
        purchaseId: 'p1',
        storeName: '!!!',
        purchasedAt: '2026-01-02T00:00:00.000Z',
        items: [],
        totalCents: 0,
        savingsCents: 0,
      }),
    ).toBe('recibo-compra-2026-01-02.png')
  })
})
