import type { Database } from './client'
import type { Repository } from './repositories'

export interface ReceiptItem {
  name: string
  categoryId: string
  unitPriceCents: number
  quantity: number
  totalCents: number
}

export interface Receipt {
  id: string
  email: string
  store: { id: string; name: string; city: string }
  purchasedAt: string
  totalCents: number
  items: ReceiptItem[]
}

/**
 * Importação pontual de compras já realizadas (NFC-e) para o histórico de um usuário.
 * Idempotente: só insere se a compra ainda não existir para o e-mail informado.
 */
export const IMPORTED_RECEIPTS: Receipt[] = [
  {
    id: 'purchase-atacadao-29131',
    email: 'matheus.puppe@gmail.com',
    store: { id: 'store-atacadao-tatuape', name: 'Atacadão Tatuapé', city: 'São Paulo' },
    purchasedAt: '2026-09-21T17:36:52.000Z',
    totalCents: 20462,
    items: [
      {
        name: 'RF.FILE DE PEITO',
        categoryId: 'mercearia',
        unitPriceCents: 1750,
        quantity: 1,
        totalCents: 1750,
      },
      {
        name: 'BISC.BAUDUCCO CHOCO 80g',
        categoryId: 'mercearia',
        unitPriceCents: 730,
        quantity: 2,
        totalCents: 1460,
      },
      {
        name: 'BISC.BAUDUCCO CHOCO 80g',
        categoryId: 'mercearia',
        unitPriceCents: 730,
        quantity: 2,
        totalCents: 1460,
      },
      {
        name: 'SUCO JUICE BOX 200ml',
        categoryId: 'mercearia',
        unitPriceCents: 249,
        quantity: 4,
        totalCents: 996,
      },
      {
        name: 'REF.COCA-COLA ZERO 2L',
        categoryId: 'mercearia',
        unitPriceCents: 1249,
        quantity: 1,
        totalCents: 1249,
      },
      {
        name: 'CHICL.TRIDENT MENTA',
        categoryId: 'mercearia',
        unitPriceCents: 299,
        quantity: 5,
        totalCents: 1495,
      },
      {
        name: 'PÃO FRANCÊS',
        categoryId: 'padaria',
        unitPriceCents: 1690,
        quantity: 0.422,
        totalCents: 713,
      },
      {
        name: 'OVO VERM. GD CAIPIRA (20un)',
        categoryId: 'mercearia',
        unitPriceCents: 1790,
        quantity: 1,
        totalCents: 1790,
      },
      {
        name: 'SUCO DEL VALLE MAIS 1L',
        categoryId: 'mercearia',
        unitPriceCents: 899,
        quantity: 1,
        totalCents: 899,
      },
      {
        name: 'CAFÉ 3 CORAÇÕES CAPPUCCINO',
        categoryId: 'mercearia',
        unitPriceCents: 1690,
        quantity: 1,
        totalCents: 1690,
      },
      {
        name: 'CAFÉ 3 CORAÇÕES',
        categoryId: 'mercearia',
        unitPriceCents: 1690,
        quantity: 1,
        totalCents: 1690,
      },
      {
        name: 'TOMATE SALADA',
        categoryId: 'hortifruti',
        unitPriceCents: 1290,
        quantity: 0.54,
        totalCents: 697,
      },
      {
        name: 'MIGNONETO SADIA 180g',
        categoryId: 'mercearia',
        unitPriceCents: 1090,
        quantity: 1,
        totalCents: 1090,
      },
      {
        name: 'ESPONJA EXTREMA (3un)',
        categoryId: 'limpeza',
        unitPriceCents: 695,
        quantity: 1,
        totalCents: 695,
      },
      {
        name: 'BANANA PRATA',
        categoryId: 'hortifruti',
        unitPriceCents: 1090,
        quantity: 0.66,
        totalCents: 719,
      },
      {
        name: 'CEREAL MAT. KELLOGGS 510g',
        categoryId: 'mercearia',
        unitPriceCents: 1949,
        quantity: 1,
        totalCents: 1949,
      },
      {
        name: 'SACOLA INSTITUCIONAL',
        categoryId: 'limpeza',
        unitPriceCents: 30,
        quantity: 4,
        totalCents: 120,
      },
    ],
  },
]

export function importReceipts(repo: Repository, db: Database): void {
  for (const receipt of IMPORTED_RECEIPTS) {
    const user = db.prepare('SELECT id FROM "user" WHERE email = ?').get(receipt.email) as
      { id: string } | undefined
    if (!user) continue
    if (repo.purchases.get(receipt.id)) continue
    if (!repo.stores.get(receipt.store.id)) {
      repo.stores.insert(receipt.store)
    }
    repo.purchases.create(
      {
        id: receipt.id,
        userId: user.id,
        storeId: receipt.store.id,
        budgetCents: 0,
        totalCents: receipt.totalCents,
        savingsCents: 0,
        itemCount: receipt.items.length,
        purchasedAt: receipt.purchasedAt,
      },
      receipt.items.map((item) => ({
        productId: null,
        name: item.name,
        categoryId: item.categoryId,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        totalCents: item.totalCents,
        wasPromo: false,
      })),
    )
  }
}
