# Painel Admin — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma área administrativa desktop em `/admin` protegida por allowlist de e-mails, onde o admin gerencia lojas, produtos e categorias (CRUD completo) e consulta usuários (somente leitura).

**Architecture:** Segue o padrão em camadas existente — `rota/componente → createServerFn → requireAdmin → service → repository → SQLite`. A autorização é uma allowlist por env (`ADMIN_EMAILS`), sem alterar o schema. O admin usa um shell desktop próprio, fora do container mobile `max-w-lg`.

**Tech Stack:** TanStack Start/Router (file routes), React 19, Tailwind v4 com design tokens, better-sqlite3 (SQL raw), better-auth, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-20-admin-panel-design.md`

---

## Nota de correção da spec

A coluna `products.barcode` é `TEXT NOT NULL UNIQUE` (`src/server/db/schema.ts:18`), então não é possível gravar `NULL`. Ajuste em relação ao spec: quando o admin não informar código de barras, o service gera um código interno único `INT-<10 hex>`; quando informar, normaliza e, se tiver 13 dígitos, exige EAN-13 válido e unicidade. A spec deve ser atualizada no Task 18.

## Estrutura de arquivos

**Criar:**

- `src/server/auth/admin.ts` — allowlist, `getAdminSession`, `requireAdmin`
- `src/server/auth/admin.test.ts`
- `src/server/db/slug.ts` — `slugify`, `uniqueSlug`
- `src/server/db/slug.test.ts`
- `src/server/services/admin-types.ts` — tipos compartilhados (overview, detalhe, paginação)
- `src/server/services/admin-service.ts` — CRUD + validações + guards
- `src/server/services/admin-service.test.ts`
- `src/server/functions/admin.ts` — server functions
- `src/components/admin/primitives.tsx` — tabela, modal, campos, paginação
- `src/components/admin/AdminShell.tsx` — sidebar + topbar desktop
- `src/routes/admin.tsx` — layout `/admin` + guard
- `src/routes/admin.index.tsx` — visão geral
- `src/routes/admin.lojas.tsx`
- `src/routes/admin.produtos.tsx`
- `src/routes/admin.categorias.tsx`
- `src/routes/admin.usuarios.tsx`
- `src/routes/admin.usuarios.$userId.tsx`

**Modificar:**

- `src/server/db/models.ts` — tipos `Admin*Record`
- `src/server/db/repositories.ts` — CRUD + consultas admin
- `src/server/db/repositories.test.ts` — testes das novas consultas
- `src/routes/__root.tsx` — admin fora do shell mobile e do onboarding
- `src/components/BottomNav.tsx` — esconder em `/admin`
- `.env.example`, `README.md`

---

## Task 1: Módulo de autorização admin

**Files:**

- Create: `src/server/auth/admin.ts`
- Test: `src/server/auth/admin.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Create `src/server/auth/admin.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { adminEmails, isAdminEmail } from './admin'

const ORIGINAL = process.env.ADMIN_EMAILS

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS
  else process.env.ADMIN_EMAILS = ORIGINAL
})

describe('admin allowlist', () => {
  it('retorna lista vazia quando ADMIN_EMAILS não está definido', () => {
    delete process.env.ADMIN_EMAILS
    expect(adminEmails()).toEqual([])
  })

  it('separa a lista por vírgula, apara e converte para minúsculas', () => {
    process.env.ADMIN_EMAILS = ' Admin@Example.com , second@x.dev '
    expect(adminEmails()).toEqual(['admin@example.com', 'second@x.dev'])
  })

  it('é fail-closed sem configuração', () => {
    delete process.env.ADMIN_EMAILS
    expect(isAdminEmail('admin@example.com')).toBe(false)
  })

  it('compara e-mails sem diferenciar maiúsculas', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    expect(isAdminEmail('ADMIN@Example.com')).toBe(true)
    expect(isAdminEmail('other@example.com')).toBe(false)
  })

  it('rejeita null e undefined', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/server/auth/admin.test.ts`
Expected: FAIL com "Failed to resolve import ./admin".

- [ ] **Step 3: Implementar**

Create `src/server/auth/admin.ts`:

```ts
import type { AuthUser } from './auth'
import { getCurrentUser, requireSession, type AuthContext } from './session'

export const FORBIDDEN_ADMIN = 'FORBIDDEN_ADMIN'

/** Allowlist de e-mails admin lida de `ADMIN_EMAILS` (CSV). Vazia ⇒ ninguém é admin. */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return adminEmails().includes(email.trim().toLowerCase())
}

export async function getAdminSession(): Promise<{ user: AuthUser | null; isAdmin: boolean }> {
  const user = await getCurrentUser()
  return { user, isAdmin: isAdminEmail(user?.email) }
}

export async function requireAdmin(): Promise<AuthContext> {
  const context = await requireSession()
  if (!isAdminEmail(context.user.email)) {
    throw new Error(FORBIDDEN_ADMIN)
  }
  return context
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npx vitest run src/server/auth/admin.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/server/auth/admin.ts src/server/auth/admin.test.ts
git commit -m "feat(admin): add admin email allowlist"
```

---

## Task 2: Helper de slug

**Files:**

- Create: `src/server/db/slug.ts`
- Test: `src/server/db/slug.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Create `src/server/db/slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { slugify, uniqueSlug } from './slug'

describe('slugify', () => {
  it('remove acentos e aplica minúsculas', () => {
    expect(slugify('Pão de Açúcar')).toBe('pao-de-acucar')
  })

  it('troca símbolos por hífen e colapsa separadores', () => {
    expect(slugify('Café  Torrado -- 500g!')).toBe('cafe-torrado-500g')
  })

  it('apara hífens nas pontas', () => {
    expect(slugify('  --Leite--  ')).toBe('leite')
  })
})

describe('uniqueSlug', () => {
  it('retorna a base quando livre', () => {
    expect(uniqueSlug('Leite', () => false)).toBe('leite')
  })

  it('adiciona sufixo incremental em caso de colisão', () => {
    const taken = new Set(['leite', 'leite-2'])
    expect(uniqueSlug('Leite', (candidate) => taken.has(candidate))).toBe('leite-3')
  })

  it('usa "item" quando o nome não gera slug', () => {
    expect(uniqueSlug('!!!', () => false)).toBe('item')
  })
})
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/server/db/slug.test.ts`
Expected: FAIL com "Failed to resolve import ./slug".

- [ ] **Step 3: Implementar**

Create `src/server/db/slug.ts`:

```ts
/** Gera um slug estável a partir de um texto livre. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Gera um slug único consultando `exists` e adicionando sufixo numérico se preciso. */
export function uniqueSlug(base: string, exists: (candidate: string) => boolean): string {
  const root = slugify(base) || 'item'
  if (!exists(root)) return root
  let suffix = 2
  while (exists(`${root}-${suffix}`)) suffix += 1
  return `${root}-${suffix}`
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npx vitest run src/server/db/slug.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/server/db/slug.ts src/server/db/slug.test.ts
git commit -m "feat(admin): add slug helpers"
```

---

## Task 3: Tipos admin e CRUD de categorias/lojas no repositório

**Files:**

- Modify: `src/server/db/models.ts`
- Modify: `src/server/db/repositories.ts`
- Test: `src/server/db/repositories.test.ts`

- [ ] **Step 1: Adicionar os tipos admin em `models.ts`**

No fim de `src/server/db/models.ts`, acrescente:

```ts
export interface AdminCategoryRecord extends Category {
  productCount: number
  referenceCount: number
}

export interface AdminStoreRecord extends Store {
  usageCount: number
}

export interface AdminProductRecord {
  id: string
  barcode: string
  name: string
  brand: string | null
  categoryId: string
  categoryName: string
  unit: Unit
  priceCents: number
  imageUrl: string | null
  aisle: string | null
  usageCount: number
}

export interface AdminUserRecord {
  id: string
  name: string
  email: string
  createdAt: string
  listCount: number
  cartCount: number
  purchaseCount: number
  totalSpentCents: number
}

export interface AdminPurchaseRecord {
  id: string
  userId: string
  userName: string
  storeId: string
  storeName: string
  totalCents: number
  itemCount: number
  purchasedAt: string
}
```

- [ ] **Step 2: Escrever o teste que falha**

Em `src/server/db/repositories.test.ts`, adicione estes dois blocos `describe` ao final do arquivo:

```ts
describe('category repository (admin)', () => {
  it('cria, atualiza e remove categorias', () => {
    repo.categories.insert({
      id: 'bebidas',
      name: 'Bebidas',
      icon: 'local_drink',
      color: 'primary',
    })
    expect(repo.categories.adminGet('bebidas')?.name).toBe('Bebidas')

    repo.categories.update('bebidas', { name: 'Bebidas e Sucos' })
    expect(repo.categories.get('bebidas')?.name).toBe('Bebidas e Sucos')

    repo.categories.remove('bebidas')
    expect(repo.categories.get('bebidas')).toBeNull()
  })

  it('conta produtos por categoria', () => {
    seedProduct()
    expect(repo.categories.adminGet('mercearia')?.productCount).toBe(1)
    expect(repo.categories.adminGet('laticinios')?.productCount).toBe(0)
  })
})

describe('store repository (admin)', () => {
  it('atualiza nome e cidade', () => {
    repo.stores.update('store-1', { name: 'Mercado Novo', city: 'Campinas' })
    expect(repo.stores.get('store-1')).toEqual({
      id: 'store-1',
      name: 'Mercado Novo',
      city: 'Campinas',
    })
  })

  it('conta uso em carrinhos, compras e histórico', () => {
    repo.carts.getOrCreateActive({ userId: USER, storeId: 'store-1', budgetCents: 1000 })
    expect(repo.stores.countUsage('store-1')).toBe(1)
    expect(repo.stores.adminGet('store-1')?.usageCount).toBe(1)
  })

  it('remove lojas sem uso', () => {
    repo.stores.insert({ id: 'store-2', name: 'Sem uso', city: null })
    repo.stores.remove('store-2')
    expect(repo.stores.get('store-2')).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar o teste para ver falhar**

Run: `npx vitest run src/server/db/repositories.test.ts`
Expected: FAIL com "repo.categories.insert is not a function".

- [ ] **Step 4: Adicionar os mappers no topo de `repositories.ts`**

Substitua o import de `./models` (linhas ~5-17) por:

```ts
import type {
  AdminCategoryRecord,
  AdminProductRecord,
  AdminPurchaseRecord,
  AdminStoreRecord,
  AdminUserRecord,
  Cart,
  Category,
  NewCartLine,
  NewListItem,
  NewPurchase,
  NewPurchaseItem,
  PriceEntry,
  Product,
  PurchaseItem,
  ShoppingList,
  Store,
} from './models'
```

Depois de `function toPriceEntry(row: any): PriceEntry { ... }` (linha ~124), adicione:

```ts
function toAdminCategoryRecord(row: any): AdminCategoryRecord {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    productCount: row.product_count,
    referenceCount: row.product_count + row.list_item_count,
  }
}

function toAdminStoreRecord(row: any): AdminStoreRecord {
  return { id: row.id, name: row.name, city: row.city, usageCount: row.usage_count }
}

function toAdminProductRecord(row: any): AdminProductRecord {
  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    categoryId: row.category_id,
    categoryName: row.category_name ?? '',
    unit: row.unit as Unit,
    priceCents: row.price_cents,
    imageUrl: row.image_url,
    aisle: row.aisle,
    usageCount: row.usage_count,
  }
}

function toAdminUserRecord(row: any): AdminUserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
    listCount: row.list_count,
    cartCount: row.cart_count,
    purchaseCount: row.purchase_count,
    totalSpentCents: row.total_spent_cents,
  }
}

function toAdminPurchaseRecord(row: any): AdminPurchaseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name ?? '',
    storeId: row.store_id,
    storeName: row.store_name ?? '',
    totalCents: row.total_cents,
    itemCount: row.item_count,
    purchasedAt: row.purchased_at,
  }
}

function userFilter(filter: { search?: string }): { clause: string; params: unknown[] } {
  if (!filter.search) return { clause: '', params: [] }
  const term = `%${filter.search.toLowerCase()}%`
  return { clause: 'WHERE lower(u.name) LIKE ? OR lower(u.email) LIKE ?', params: [term, term] }
}

function productFilter(filter: { search?: string; categoryId?: string }): {
  clause: string
  params: unknown[]
} {
  const conditions: string[] = []
  const params: unknown[] = []
  if (filter.search) {
    conditions.push("(lower(p.name) LIKE ? OR lower(coalesce(p.brand, '')) LIKE ?)")
    const term = `%${filter.search.toLowerCase()}%`
    params.push(term, term)
  }
  if (filter.categoryId) {
    conditions.push('p.category_id = ?')
    params.push(filter.categoryId)
  }
  return { clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params }
}
```

- [ ] **Step 5: Substituir o objeto `categories`**

Substitua todo o bloco `const categories = { ... }` (linhas ~127-152) por:

```ts
const categories = {
  upsert(category: { id: string; name: string; icon?: string; color?: string }): Category {
    db.prepare(
      `INSERT INTO categories (id, name, icon, color) VALUES (@id, @name, @icon, @color)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon, color = excluded.color`,
    ).run({
      id: category.id,
      name: category.name,
      icon: category.icon ?? 'category',
      color: category.color ?? 'primary',
    })
    return categories.get(category.id)!
  },
  insert(category: { id: string; name: string; icon?: string; color?: string }): Category {
    db.prepare(
      'INSERT INTO categories (id, name, icon, color) VALUES (@id, @name, @icon, @color)',
    ).run({
      id: category.id,
      name: category.name,
      icon: category.icon ?? 'category',
      color: category.color ?? 'primary',
    })
    return categories.get(category.id)!
  },
  update(id: string, changes: { name?: string; icon?: string; color?: string }): Category | null {
    const current = categories.get(id)
    if (!current) return null
    db.prepare('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?').run(
      changes.name ?? current.name,
      changes.icon ?? current.icon,
      changes.color ?? current.color,
      id,
    )
    return categories.get(id)
  },
  remove(id: string): void {
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  },
  countReferences(id: string): number {
    return categories.adminGet(id)?.referenceCount ?? 0
  },
  adminGet(id: string): AdminCategoryRecord | null {
    const row = db
      .prepare(
        `SELECT c.*,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count,
            (SELECT COUNT(*) FROM list_items li WHERE li.category_id = c.id) AS list_item_count
           FROM categories c WHERE c.id = ?`,
      )
      .get(id) as any
    return row ? toAdminCategoryRecord(row) : null
  },
  adminList(): AdminCategoryRecord[] {
    return (
      db
        .prepare(
          `SELECT c.*,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count,
              (SELECT COUNT(*) FROM list_items li WHERE li.category_id = c.id) AS list_item_count
             FROM categories c ORDER BY c.name`,
        )
        .all() as any[]
    ).map(toAdminCategoryRecord)
  },
  get(id: string): Category | null {
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any
    return row ? { id: row.id, name: row.name, icon: row.icon, color: row.color } : null
  },
  list(): Category[] {
    return (db.prepare('SELECT * FROM categories ORDER BY name').all() as any[]).map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
    }))
  },
}
```

- [ ] **Step 6: Adicionar métodos admin ao objeto `stores`**

Dentro do objeto `stores`, após o método `list()`, adicione antes do `}` de fechamento:

```ts
    update(id: string, changes: { name?: string; city?: string | null }): Store | null {
      const current = stores.get(id)
      if (!current) return null
      db.prepare('UPDATE stores SET name = ?, city = ? WHERE id = ?').run(
        changes.name ?? current.name,
        changes.city === undefined ? current.city : changes.city,
        id,
      )
      return stores.get(id)
    },
    remove(id: string): void {
      db.prepare('DELETE FROM stores WHERE id = ?').run(id)
    },
    countUsage(id: string): number {
      const row = db
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM carts WHERE store_id = ?) +
            (SELECT COUNT(*) FROM purchases WHERE store_id = ?) +
            (SELECT COUNT(*) FROM price_history WHERE store_id = ?) AS total`,
        )
        .get(id, id, id) as { total: number }
      return row.total
    },
    adminGet(id: string): AdminStoreRecord | null {
      const row = db
        .prepare(
          `SELECT s.*,
            (SELECT COUNT(*) FROM carts WHERE store_id = s.id) +
            (SELECT COUNT(*) FROM purchases WHERE store_id = s.id) +
            (SELECT COUNT(*) FROM price_history WHERE store_id = s.id) AS usage_count
           FROM stores s WHERE s.id = ?`,
        )
        .get(id) as any
      return row ? toAdminStoreRecord(row) : null
    },
    adminList(): AdminStoreRecord[] {
      return (
        db
          .prepare(
            `SELECT s.*,
              (SELECT COUNT(*) FROM carts WHERE store_id = s.id) +
              (SELECT COUNT(*) FROM purchases WHERE store_id = s.id) +
              (SELECT COUNT(*) FROM price_history WHERE store_id = s.id) AS usage_count
             FROM stores s ORDER BY s.name`,
          )
          .all() as any[]
      ).map(toAdminStoreRecord)
    },
```

- [ ] **Step 7: Rodar os testes para ver passar**

Run: `npx vitest run src/server/db/repositories.test.ts`
Expected: PASS (todos os testes existentes + 5 novos).

- [ ] **Step 8: Commit**

```bash
git add src/server/db/models.ts src/server/db/repositories.ts src/server/db/repositories.test.ts
git commit -m "feat(admin): add category and store admin repository methods"
```

---

## Task 4: CRUD de produtos e consultas admin no repositório

**Files:**

- Modify: `src/server/db/repositories.ts`
- Test: `src/server/db/repositories.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Em `src/server/db/repositories.test.ts`, adicione:

```ts
describe('product repository (admin)', () => {
  it('atualiza campos do produto', () => {
    seedProduct()
    repo.products.update('prod-1', { name: 'Café Premium', priceCents: 2590 })
    expect(repo.products.get('prod-1')?.name).toBe('Café Premium')
    expect(repo.products.get('prod-1')?.priceCents).toBe(2590)
  })

  it('conta uso do produto em itens e histórico', () => {
    seedProduct()
    const cart = repo.carts.getOrCreateActive({ userId: USER, storeId: 'store-1' })
    repo.carts.addLine(cart.id, {
      productId: 'prod-1',
      name: 'Café',
      categoryId: 'mercearia',
      unitPriceCents: 1000,
    })
    expect(repo.products.countUsage('prod-1')).toBe(1)
    expect(repo.products.adminGet('prod-1')?.usageCount).toBe(1)
  })

  it('lista e filtra produtos com nome da categoria', () => {
    seedProduct()
    seedProduct({ id: 'prod-2', barcode: '7891000244103', name: 'Leite', brand: 'Nestlé' })
    const all = repo.products.adminList({})
    expect(all).toHaveLength(2)
    expect(all[0]?.categoryName).toBeTruthy()
    expect(repo.products.adminList({ search: 'leite' }).map((p) => p.id)).toEqual(['prod-2'])
    expect(repo.products.adminList({ categoryId: 'laticinios' })).toHaveLength(0)
    expect(repo.products.adminCount({ search: 'leite' })).toBe(1)
  })

  it('remove produto sem uso', () => {
    seedProduct()
    repo.products.remove('prod-1')
    expect(repo.products.get('prod-1')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/server/db/repositories.test.ts`
Expected: FAIL com "repo.products.update is not a function".

- [ ] **Step 3: Adicionar os métodos ao objeto `products`**

Dentro do objeto `products`, após o método `list()`, adicione:

```ts
    update(
      id: string,
      changes: {
        barcode?: string
        name?: string
        brand?: string | null
        categoryId?: string
        unit?: Unit
        priceCents?: number
        imageUrl?: string | null
        aisle?: string | null
      },
    ): Product | null {
      const current = products.get(id)
      if (!current) return null
      db.prepare(
        `UPDATE products
           SET barcode = @barcode, name = @name, brand = @brand, category_id = @categoryId,
               unit = @unit, price_cents = @priceCents, image_url = @imageUrl, aisle = @aisle
         WHERE id = @id`,
      ).run({
        id,
        barcode: changes.barcode ?? current.barcode,
        name: changes.name ?? current.name,
        brand: changes.brand === undefined ? current.brand : changes.brand,
        categoryId: changes.categoryId ?? current.categoryId,
        unit: changes.unit ?? current.unit,
        priceCents: changes.priceCents ?? current.priceCents,
        imageUrl: changes.imageUrl === undefined ? current.imageUrl : changes.imageUrl,
        aisle: changes.aisle === undefined ? current.aisle : changes.aisle,
      })
      return products.get(id)
    },
    remove(id: string): void {
      db.prepare('DELETE FROM products WHERE id = ?').run(id)
    },
    countUsage(id: string): number {
      const row = db
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM cart_items WHERE product_id = ?) +
            (SELECT COUNT(*) FROM list_items WHERE product_id = ?) +
            (SELECT COUNT(*) FROM purchase_items WHERE product_id = ?) +
            (SELECT COUNT(*) FROM price_history WHERE product_id = ?) AS total`,
        )
        .get(id, id, id, id) as { total: number }
      return row.total
    },
    adminGet(id: string): AdminProductRecord | null {
      const row = db
        .prepare(
          `SELECT p.*, c.name AS category_name,
            (SELECT COUNT(*) FROM cart_items WHERE product_id = p.id) +
            (SELECT COUNT(*) FROM list_items WHERE product_id = p.id) +
            (SELECT COUNT(*) FROM purchase_items WHERE product_id = p.id) +
            (SELECT COUNT(*) FROM price_history WHERE product_id = p.id) AS usage_count
           FROM products p LEFT JOIN categories c ON c.id = p.category_id
           WHERE p.id = ?`,
        )
        .get(id) as any
      return row ? toAdminProductRecord(row) : null
    },
    adminList(filter: {
      search?: string
      categoryId?: string
      limit?: number
      offset?: number
    }): AdminProductRecord[] {
      const { clause, params } = productFilter(filter)
      return (
        db
          .prepare(
            `SELECT p.*, c.name AS category_name,
              (SELECT COUNT(*) FROM cart_items WHERE product_id = p.id) +
              (SELECT COUNT(*) FROM list_items WHERE product_id = p.id) +
              (SELECT COUNT(*) FROM purchase_items WHERE product_id = p.id) +
              (SELECT COUNT(*) FROM price_history WHERE product_id = p.id) AS usage_count
             FROM products p LEFT JOIN categories c ON c.id = p.category_id
             ${clause}
             ORDER BY p.name LIMIT ? OFFSET ?`,
          )
          .all(...params, filter.limit ?? 50, filter.offset ?? 0) as any[]
      ).map(toAdminProductRecord)
    },
    adminCount(filter: { search?: string; categoryId?: string }): number {
      const { clause, params } = productFilter(filter)
      const row = db
        .prepare(`SELECT COUNT(*) AS total FROM products p ${clause}`)
        .get(...params) as { total: number }
      return row.total
    },
```

- [ ] **Step 4: Rodar os testes para ver passar**

Run: `npx vitest run src/server/db/repositories.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/repositories.ts src/server/db/repositories.test.ts
git commit -m "feat(admin): add product admin repository methods"
```

---

## Task 5: Repositório de usuários, compras e listagens por usuário

**Files:**

- Modify: `src/server/db/repositories.ts`
- Test: `src/server/db/repositories.test.ts`

- [ ] **Step 1: Preparar a tabela `user` e escrever os testes**

Em `src/server/db/repositories.test.ts`, no `beforeEach` existente, adicione ao final do bloco (após `repo.stores.insert(...)`):

```ts
db.exec(
  `CREATE TABLE IF NOT EXISTS "user" (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       email TEXT NOT NULL UNIQUE,
       emailVerified INTEGER NOT NULL DEFAULT 0,
       image TEXT,
       createdAt TEXT NOT NULL DEFAULT (datetime('now')),
       updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
)
```

Depois, no fim do arquivo, adicione:

```ts
function seedUser(id: string, name: string, email: string) {
  db.prepare('INSERT INTO "user" (id, name, email) VALUES (?, ?, ?)').run(id, name, email)
}

describe('user repository (admin)', () => {
  it('lista usuários com contagens e total gasto', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    repo.lists.create({ userId: 'u1', name: 'Semana', shoppingDate: '2026-09-01' })
    repo.purchases.create({
      userId: 'u1',
      storeId: 'store-1',
      budgetCents: 10000,
      totalCents: 5000,
      savingsCents: 0,
      itemCount: 2,
      purchasedAt: '2026-09-01T10:00:00.000Z',
    })
    const [user] = repo.users.list({})
    expect(user).toMatchObject({
      id: 'u1',
      email: 'ana@x.dev',
      listCount: 1,
      purchaseCount: 1,
      totalSpentCents: 5000,
    })
    expect(repo.users.count({ search: 'ana' })).toBe(1)
  })

  it('busca e obtém usuário por id', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    seedUser('u2', 'Bruno', 'bruno@x.dev')
    expect(repo.users.list({ search: 'bruno' }).map((u) => u.id)).toEqual(['u2'])
    expect(repo.users.get('u1')?.name).toBe('Ana')
    expect(repo.users.get('missing')).toBeNull()
  })
})

describe('purchases repository (admin)', () => {
  it('soma total, conta e lista recentes com nome da loja e usuário', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    repo.purchases.create({
      userId: 'u1',
      storeId: 'store-1',
      budgetCents: 10000,
      totalCents: 5000,
      savingsCents: 0,
      itemCount: 2,
      purchasedAt: '2026-09-01T10:00:00.000Z',
    })
    expect(repo.purchases.adminCount()).toBe(1)
    expect(repo.purchases.adminSumTotal()).toBe(5000)
    const [recent] = repo.purchases.adminListRecent(5)
    expect(recent?.storeName).toBe('Pão de Açúcar - Morumbi')
    expect(recent?.userName).toBe('Ana')
  })
})

describe('lists and carts by user', () => {
  it('lista listas e carrinhos de um usuário', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    repo.lists.create({ userId: 'u1', name: 'Semana', shoppingDate: '2026-09-01' })
    repo.carts.getOrCreateActive({ userId: 'u1', storeId: 'store-1' })
    expect(repo.lists.listByUser('u1')).toHaveLength(1)
    expect(repo.carts.listByUser('u1')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Rodar os testes para ver falhar**

Run: `npx vitest run src/server/db/repositories.test.ts`
Expected: FAIL com "repo.users is not defined".

- [ ] **Step 3: Adicionar métodos de compras e listagens**

No objeto `purchases`, após `getItems(...)`, adicione:

```ts
    adminCount(): number {
      const row = db.prepare('SELECT COUNT(*) AS total FROM purchases').get() as { total: number }
      return row.total
    },
    adminSumTotal(): number {
      const row = db.prepare('SELECT COALESCE(SUM(total_cents), 0) AS total FROM purchases').get() as {
        total: number
      }
      return row.total
    },
    adminListRecent(limit: number): AdminPurchaseRecord[] {
      return (
        db
          .prepare(
            `SELECT p.id, p.user_id, u.name AS user_name, p.store_id, s.name AS store_name,
               p.total_cents, p.item_count, p.purchased_at
             FROM purchases p
             LEFT JOIN stores s ON s.id = p.store_id
             LEFT JOIN "user" u ON u.id = p.user_id
             ORDER BY p.purchased_at DESC LIMIT ?`,
          )
          .all(limit) as any[]
      ).map(toAdminPurchaseRecord)
    },
```

No objeto `lists`, após `progress(...)`, adicione:

```ts
    listByUser(userId: string): ShoppingList[] {
      return (
        db
          .prepare('SELECT * FROM shopping_lists WHERE user_id = ? ORDER BY created_at DESC')
          .all(userId) as any[]
      ).map(toShoppingList)
    },
```

No objeto `carts`, após `listLines(...)`, adicione:

```ts
    listByUser(userId: string): Cart[] {
      return (
        db.prepare('SELECT * FROM carts WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[]
      ).map(toCart)
    },
```

- [ ] **Step 4: Adicionar o namespace `users`**

Antes do `return { categories, stores, ... }` final, adicione:

```ts
const users = {
  list(filter: { search?: string; limit?: number; offset?: number } = {}): AdminUserRecord[] {
    const { clause, params } = userFilter(filter)
    return (
      db
        .prepare(
          `SELECT u.id, u.name, u.email, u.createdAt,
              (SELECT COUNT(*) FROM shopping_lists sl WHERE sl.user_id = u.id) AS list_count,
              (SELECT COUNT(*) FROM carts c WHERE c.user_id = u.id) AS cart_count,
              (SELECT COUNT(*) FROM purchases p WHERE p.user_id = u.id) AS purchase_count,
              (SELECT COALESCE(SUM(p.total_cents), 0) FROM purchases p WHERE p.user_id = u.id) AS total_spent_cents
             FROM "user" u ${clause}
             ORDER BY u.createdAt DESC LIMIT ? OFFSET ?`,
        )
        .all(...params, filter.limit ?? 50, filter.offset ?? 0) as any[]
    ).map(toAdminUserRecord)
  },
  count(filter: { search?: string } = {}): number {
    const { clause, params } = userFilter(filter)
    const row = db.prepare(`SELECT COUNT(*) AS total FROM "user" u ${clause}`).get(...params) as {
      total: number
    }
    return row.total
  },
  get(id: string): AdminUserRecord | null {
    const row = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.createdAt,
            (SELECT COUNT(*) FROM shopping_lists sl WHERE sl.user_id = u.id) AS list_count,
            (SELECT COUNT(*) FROM carts c WHERE c.user_id = u.id) AS cart_count,
            (SELECT COUNT(*) FROM purchases p WHERE p.user_id = u.id) AS purchase_count,
            (SELECT COALESCE(SUM(p.total_cents), 0) FROM purchases p WHERE p.user_id = u.id) AS total_spent_cents
           FROM "user" u WHERE u.id = ?`,
      )
      .get(id) as any
    return row ? toAdminUserRecord(row) : null
  },
}
```

Atualize o `return` final para incluir `users`:

```ts
return { categories, stores, products, carts, lists, purchases, priceHistory, preferences, users }
```

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `npx vitest run src/server/db/repositories.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/db/repositories.ts src/server/db/repositories.test.ts
git commit -m "feat(admin): add user, purchase and per-user queries"
```

---

## Task 6: Admin types e service — lojas e categorias

**Files:**

- Create: `src/server/services/admin-types.ts`
- Create: `src/server/services/admin-service.ts`
- Test: `src/server/services/admin-service.test.ts`

- [ ] **Step 1: Criar os tipos compartilhados**

Create `src/server/services/admin-types.ts`:

```ts
import type { Purchase } from '../../domain/types'
import type {
  AdminCategoryRecord,
  AdminProductRecord,
  AdminPurchaseRecord,
  AdminStoreRecord,
  AdminUserRecord,
  Cart,
  ShoppingList,
} from '../db/models'

export interface PageFilter {
  search?: string
  page?: number
  pageSize?: number
}

export interface ListResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AdminOverview {
  counts: {
    users: number
    stores: number
    products: number
    categories: number
    purchases: number
  }
  gmvCents: number
  recentPurchases: AdminPurchaseRecord[]
}

export interface AdminStoreList {
  stores: AdminStoreRecord[]
}

export interface AdminProductList extends ListResult<AdminProductRecord> {
  categories: AdminCategoryRecord[]
}

export interface AdminUserDetail {
  user: AdminUserRecord
  lists: ShoppingList[]
  carts: Cart[]
  purchases: Purchase[]
}
```

- [ ] **Step 2: Escrever o teste que falha**

Create `src/server/services/admin-service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type Database } from '../db/client'
import { createRepository, type Repository } from '../db/repositories'
import {
  createCategory,
  createStore,
  deleteCategory,
  deleteStore,
  listCategories,
  listStores,
  updateCategory,
  updateStore,
} from './admin-service'

let db: Database
let repo: Repository

beforeEach(() => {
  db = createDatabase(':memory:')
  repo = createRepository(db)
  repo.categories.upsert({
    id: 'mercearia',
    name: 'Mercearia',
    icon: 'local_cafe',
    color: 'primary',
  })
  repo.stores.insert({ id: 'store-1', name: 'Pão de Açúcar', city: 'São Paulo' })
})

describe('admin stores', () => {
  it('cria loja com id de slug', () => {
    const store = createStore(repo, { name: 'Pão de Açúcar', city: 'Campinas' })
    expect(store.id).toBe('pao-de-acucar')
    expect(store.name).toBe('Pão de Açúcar')
    expect(store.usageCount).toBe(0)
  })

  it('gera id único quando o slug colide', () => {
    const first = createStore(repo, { name: 'Extra' })
    const second = createStore(repo, { name: 'Extra' })
    expect(first.id).toBe('extra')
    expect(second.id).toBe('extra-2')
  })

  it('rejeita nome vazio', () => {
    expect(() => createStore(repo, { name: '   ' })).toThrow('Nome da loja é obrigatório.')
  })

  it('atualiza loja existente', () => {
    updateStore(repo, 'store-1', { name: 'Mercado Novo', city: 'Santos' })
    expect(repo.stores.get('store-1')).toMatchObject({ name: 'Mercado Novo', city: 'Santos' })
  })

  it('bloqueia exclusão de loja em uso', () => {
    repo.carts.getOrCreateActive({ userId: 'u1', storeId: 'store-1' })
    expect(() => deleteStore(repo, 'store-1')).toThrow(
      'Não é possível excluir: 1 registro(s) usam esta loja.',
    )
  })

  it('exclui loja sem uso', () => {
    const store = createStore(repo, { name: 'Sem uso' })
    deleteStore(repo, store.id)
    expect(repo.stores.get(store.id)).toBeNull()
  })

  it('lista lojas com contagem de uso', () => {
    expect(listStores(repo).map((s) => s.id)).toContain('store-1')
  })
})

describe('admin categories', () => {
  it('cria categoria com slug e cor padrão', () => {
    const category = createCategory(repo, { name: 'Bebidas' })
    expect(category.id).toBe('bebidas')
    expect(category.color).toBe('primary')
    expect(category.icon).toBe('category')
  })

  it('rejeita cor inválida', () => {
    expect(() => createCategory(repo, { name: 'Bebidas', color: 'rosa' })).toThrow(
      'Cor da categoria inválida.',
    )
  })

  it('atualiza categoria', () => {
    updateCategory(repo, 'mercearia', { name: 'Mercearia Seca', icon: 'rice_bowl' })
    expect(repo.categories.get('mercearia')).toMatchObject({
      name: 'Mercearia Seca',
      icon: 'rice_bowl',
    })
  })

  it('bloqueia exclusão de categoria com produtos', () => {
    repo.products.insert({
      id: 'p1',
      barcode: '7891000244102',
      name: 'Café',
      categoryId: 'mercearia',
      priceCents: 1000,
    })
    expect(() => deleteCategory(repo, 'mercearia')).toThrow(
      'Não é possível excluir: 1 registro(s) usam esta categoria.',
    )
  })

  it('exclui categoria sem produtos', () => {
    deleteCategory(repo, 'mercearia')
    expect(repo.categories.get('mercearia')).toBeNull()
  })

  it('lista categorias com contagem de referências', () => {
    expect(listCategories(repo).map((c) => c.referenceCount)).toContain(0)
  })
})
```

- [ ] **Step 3: Rodar o teste para ver falhar**

Run: `npx vitest run src/server/services/admin-service.test.ts`
Expected: FAIL com "Failed to resolve import ./admin-service".

- [ ] **Step 4: Implementar `admin-service.ts` (parte 1: helpers + lojas + categorias)**

Create `src/server/services/admin-service.ts`:

```ts
import type { AdminCategoryRecord, AdminStoreRecord } from '../db/models'
import type { Repository } from '../db/repositories'
import { uniqueSlug } from '../db/slug'

const COLORS = ['primary', 'secondary', 'tertiary', 'outline']
const MAX_NAME = 120

function requireName(value: string | undefined, label: string): string {
  const name = (value ?? '').trim()
  if (!name) throw new Error(`${label} é obrigatório.`)
  if (name.length > MAX_NAME) throw new Error(`${label} deve ter no máximo ${MAX_NAME} caracteres.`)
  return name
}

function optional(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed ? trimmed : null
}

function resolveColor(value?: string): string {
  const color = (value ?? 'primary').trim()
  if (!COLORS.includes(color)) throw new Error('Cor da categoria inválida.')
  return color
}

export interface StoreInput {
  name: string
  city?: string | null
}

export function listStores(repo: Repository): AdminStoreRecord[] {
  return repo.stores.adminList()
}

export function createStore(repo: Repository, input: StoreInput): AdminStoreRecord {
  const name = requireName(input.name, 'Nome da loja')
  const id = uniqueSlug(name, (candidate) => repo.stores.get(candidate) !== null)
  repo.stores.insert({ id, name, city: optional(input.city) })
  return repo.stores.adminGet(id)!
}

export function updateStore(repo: Repository, id: string, input: StoreInput): AdminStoreRecord {
  const current = repo.stores.get(id)
  if (!current) throw new Error('Loja não encontrada.')
  const name = requireName(input.name, 'Nome da loja')
  repo.stores.update(id, {
    name,
    city: input.city === undefined ? current.city : optional(input.city),
  })
  return repo.stores.adminGet(id)!
}

export function deleteStore(repo: Repository, id: string): void {
  const store = repo.stores.get(id)
  if (!store) throw new Error('Loja não encontrada.')
  const usage = repo.stores.countUsage(id)
  if (usage > 0) {
    throw new Error(`Não é possível excluir: ${usage} registro(s) usam esta loja.`)
  }
  repo.stores.remove(id)
}

export interface CategoryInput {
  name: string
  icon?: string
  color?: string
}

export function listCategories(repo: Repository): AdminCategoryRecord[] {
  return repo.categories.adminList()
}

export function createCategory(repo: Repository, input: CategoryInput): AdminCategoryRecord {
  const name = requireName(input.name, 'Nome da categoria')
  const id = uniqueSlug(name, (candidate) => repo.categories.get(candidate) !== null)
  repo.categories.insert({
    id,
    name,
    icon: optional(input.icon) ?? 'category',
    color: resolveColor(input.color),
  })
  return repo.categories.adminGet(id)!
}

export function updateCategory(
  repo: Repository,
  id: string,
  input: CategoryInput,
): AdminCategoryRecord {
  const current = repo.categories.get(id)
  if (!current) throw new Error('Categoria não encontrada.')
  repo.categories.update(id, {
    name: requireName(input.name, 'Nome da categoria'),
    icon: input.icon === undefined ? current.icon : (optional(input.icon) ?? 'category'),
    color: input.color === undefined ? current.color : resolveColor(input.color),
  })
  return repo.categories.adminGet(id)!
}

export function deleteCategory(repo: Repository, id: string): void {
  const current = repo.categories.get(id)
  if (!current) throw new Error('Categoria não encontrada.')
  const count = repo.categories.countReferences(id)
  if (count > 0) {
    throw new Error(`Não é possível excluir: ${count} registro(s) usam esta categoria.`)
  }
  repo.categories.remove(id)
}
```

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `npx vitest run src/server/services/admin-service.test.ts`
Expected: PASS (13 testes).

- [ ] **Step 6: Commit**

```bash
git add src/server/services/admin-types.ts src/server/services/admin-service.ts src/server/services/admin-service.test.ts
git commit -m "feat(admin): add store and category service"
```

---

## Task 7: Admin service — produtos

**Files:**

- Modify: `src/server/services/admin-service.ts`
- Test: `src/server/services/admin-service.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Em `src/server/services/admin-service.test.ts`, substitua o import de `./admin-service` por um único import que inclua `createProduct`, `deleteProduct`, `listProducts` e `updateProduct` (mantendo os já existentes):

```ts
import {
  createCategory,
  createProduct,
  createStore,
  deleteCategory,
  deleteProduct,
  deleteStore,
  listCategories,
  listProducts,
  listStores,
  updateCategory,
  updateProduct,
  updateStore,
} from './admin-service'
```

Adicione ao final do arquivo:

```ts
describe('admin products', () => {
  it('cria produto com slug e gera código interno quando o barcode é vazio', () => {
    const product = createProduct(repo, {
      name: 'Café Torrado',
      categoryId: 'mercearia',
      priceCents: 1890,
      unit: 'un',
    })
    expect(product.id).toBe('cafe-torrado')
    expect(product.barcode.startsWith('INT-')).toBe(true)
    expect(product.categoryName).toBe('Mercearia')
  })

  it('aceita EAN-13 válido e rejeita inválido', () => {
    const valid = createProduct(repo, {
      name: 'Leite',
      barcode: '7891000244104',
      categoryId: 'mercearia',
    })
    expect(valid.barcode).toBe('7891000244104')

    expect(() =>
      createProduct(repo, { name: 'Refri', barcode: '7891000244109', categoryId: 'mercearia' }),
    ).toThrow('Código de barras EAN-13 inválido.')
  })

  it('rejeita barcode duplicado', () => {
    repo.products.insert({
      id: 'existente',
      barcode: '7891000244104',
      name: 'Existente',
      categoryId: 'mercearia',
    })
    expect(() =>
      createProduct(repo, {
        name: 'Outro',
        barcode: '7891000244104',
        categoryId: 'mercearia',
      }),
    ).toThrow('Já existe um produto com este código de barras.')
  })

  it('rejeita categoria inexistente e preço negativo', () => {
    expect(() => createProduct(repo, { name: 'X', categoryId: 'nao-existe' })).toThrow(
      'Selecione uma categoria válida.',
    )
    expect(() =>
      createProduct(repo, { name: 'X', categoryId: 'mercearia', priceCents: -1 }),
    ).toThrow('Preço inválido.')
  })

  it('atualiza produto mantendo o barcode quando não informado', () => {
    const product = createProduct(repo, {
      name: 'Leite',
      barcode: '7891000244104',
      categoryId: 'mercearia',
    })
    const updated = updateProduct(repo, product.id, {
      name: 'Leite Integral',
      categoryId: 'mercearia',
      priceCents: 799,
    })
    expect(updated.name).toBe('Leite Integral')
    expect(updated.barcode).toBe('7891000244104')
    expect(updated.priceCents).toBe(799)
  })

  it('bloqueia exclusão de produto em uso', () => {
    const product = createProduct(repo, { name: 'Café', categoryId: 'mercearia' })
    repo.lists.create({
      userId: 'u1',
      name: 'Semana',
      shoppingDate: '2026-09-01',
    })
    const list = repo.lists.getActive('u1')!
    repo.lists.addItem(list.id, { productId: product.id, name: 'Café', categoryId: 'mercearia' })
    expect(() => deleteProduct(repo, product.id)).toThrow(
      'Não é possível excluir: 1 registro(s) usam este produto.',
    )
  })

  it('exclui produto sem uso', () => {
    const product = createProduct(repo, { name: 'Descartável', categoryId: 'mercearia' })
    deleteProduct(repo, product.id)
    expect(repo.products.get(product.id)).toBeNull()
  })

  it('lista produtos com filtro e paginação', () => {
    createProduct(repo, { name: 'Café', categoryId: 'mercearia' })
    createProduct(repo, { name: 'Leite', categoryId: 'mercearia' })
    const result = listProducts(repo, { search: 'le', page: 1, pageSize: 10 })
    expect(result.items.map((p) => p.name)).toEqual(['Leite'])
    expect(result.total).toBe(1)
    expect(result.categories.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/server/services/admin-service.test.ts`
Expected: FAIL com "createProduct is not a function".

- [ ] **Step 3: Atualizar os imports de `admin-service.ts`**

No topo de `src/server/services/admin-service.ts`, substitua o primeiro import por:

```ts
import { isValidEan13, normalizeBarcode } from '../../domain/barcode'
import type { AdminCategoryRecord, AdminProductRecord, AdminStoreRecord, Unit } from '../db/models'
```

E adicione o tipo de listagem:

```ts
import type { AdminProductList, PageFilter } from './admin-types'
```

- [ ] **Step 4: Adicionar os imports/consts e funções de produto**

Adicione `const UNITS: Unit[] = ['un', 'kg', 'L']` junto de `COLORS`, e as funções ao final de `admin-service.ts`:

```ts
function resolveBarcode(
  repo: Repository,
  raw: string | null | undefined,
  currentId?: string,
): string {
  const value = (raw ?? '').trim()
  if (!value) {
    if (currentId) {
      const current = repo.products.get(currentId)
      if (current) return current.barcode
    }
    return internalBarcode()
  }
  if (currentId && repo.products.get(currentId)?.barcode === value) return value
  if (/^INT-/i.test(value)) {
    const existing = repo.products.findByBarcode(value)
    if (existing && existing.id !== currentId) {
      throw new Error('Já existe um produto com este código de barras.')
    }
    return value
  }
  const normalized = normalizeBarcode(value)
  if (normalized.length === 13 && !isValidEan13(normalized)) {
    throw new Error('Código de barras EAN-13 inválido.')
  }
  const existing = repo.products.findByBarcode(normalized)
  if (existing && existing.id !== currentId) {
    throw new Error('Já existe um produto com este código de barras.')
  }
  return normalized
}

function internalBarcode(): string {
  const suffix = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  return `INT-${suffix}`
}

function resolvePriceCents(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0
  if (!Number.isFinite(value) || value < 0) throw new Error('Preço inválido.')
  return Math.round(value)
}

function resolveUnit(value?: string): Unit {
  const unit = (value ?? 'un').trim()
  if (!UNITS.includes(unit as Unit)) throw new Error('Unidade inválida.')
  return unit as Unit
}

function requireCategory(repo: Repository, categoryId: string | undefined): string {
  const id = (categoryId ?? '').trim()
  if (!id || !repo.categories.get(id)) throw new Error('Selecione uma categoria válida.')
  return id
}

function clampPage(filter: PageFilter): { page: number; pageSize: number } {
  const rawPage = Number(filter.page)
  const rawSize = Number(filter.pageSize)
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
  const pageSize = Number.isFinite(rawSize) ? Math.min(100, Math.max(1, Math.floor(rawSize))) : 20
  return { page, pageSize }
}

export interface ProductInput {
  barcode?: string | null
  name: string
  brand?: string | null
  categoryId: string
  unit?: string
  priceCents?: number | null
  imageUrl?: string | null
  aisle?: string | null
}

export function listProducts(
  repo: Repository,
  filter: PageFilter & { categoryId?: string } = {},
): AdminProductList {
  const { page, pageSize } = clampPage(filter)
  const items = repo.products.adminList({
    search: filter.search,
    categoryId: filter.categoryId,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })
  const total = repo.products.adminCount({ search: filter.search, categoryId: filter.categoryId })
  return { items, total, page, pageSize, categories: repo.categories.adminList() }
}

export function createProduct(repo: Repository, input: ProductInput): AdminProductRecord {
  const name = requireName(input.name, 'Nome do produto')
  const id = uniqueSlug(name, (candidate) => repo.products.get(candidate) !== null)
  repo.products.insert({
    id,
    barcode: resolveBarcode(repo, input.barcode),
    name,
    brand: optional(input.brand),
    categoryId: requireCategory(repo, input.categoryId),
    unit: resolveUnit(input.unit),
    priceCents: resolvePriceCents(input.priceCents),
    imageUrl: optional(input.imageUrl),
    aisle: optional(input.aisle),
  })
  return repo.products.adminGet(id)!
}

export function updateProduct(
  repo: Repository,
  id: string,
  input: ProductInput,
): AdminProductRecord {
  const current = repo.products.get(id)
  if (!current) throw new Error('Produto não encontrado.')
  repo.products.update(id, {
    barcode: resolveBarcode(repo, input.barcode, id),
    name: requireName(input.name, 'Nome do produto'),
    brand: input.brand === undefined ? current.brand : optional(input.brand),
    categoryId: requireCategory(repo, input.categoryId),
    unit: input.unit === undefined ? current.unit : resolveUnit(input.unit),
    priceCents:
      input.priceCents === undefined || input.priceCents === null
        ? current.priceCents
        : resolvePriceCents(input.priceCents),
    imageUrl: input.imageUrl === undefined ? current.imageUrl : optional(input.imageUrl),
    aisle: input.aisle === undefined ? current.aisle : optional(input.aisle),
  })
  return repo.products.adminGet(id)!
}

export function deleteProduct(repo: Repository, id: string): void {
  const current = repo.products.get(id)
  if (!current) throw new Error('Produto não encontrado.')
  const usage = repo.products.countUsage(id)
  if (usage > 0) {
    throw new Error(`Não é possível excluir: ${usage} registro(s) usam este produto.`)
  }
  repo.products.remove(id)
}
```

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `npx vitest run src/server/services/admin-service.test.ts`
Expected: PASS (21 testes).

- [ ] **Step 6: Commit**

```bash
git add src/server/services/admin-service.ts src/server/services/admin-service.test.ts
git commit -m "feat(admin): add product service"
```

---

## Task 8: Admin service — visão geral e usuários

**Files:**

- Modify: `src/server/services/admin-service.ts`
- Test: `src/server/services/admin-service.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicione ao final de `src/server/services/admin-service.test.ts`. Primeiro garanta que o import de
`./admin-service` inclua `getOverview`, `getUserDetail` e `listUsers`:

```ts
import {
  createCategory,
  createProduct,
  createStore,
  deleteCategory,
  deleteProduct,
  deleteStore,
  getOverview,
  getUserDetail,
  listCategories,
  listProducts,
  listStores,
  listUsers,
  updateCategory,
  updateProduct,
  updateStore,
} from './admin-service'
```

Adicione também um helper e os testes (a tabela `"user"` precisa existir; crie no teste):

```ts
function ensureUserTable() {
  db.exec(
    `CREATE TABLE IF NOT EXISTS "user" (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       email TEXT NOT NULL UNIQUE,
       emailVerified INTEGER NOT NULL DEFAULT 0,
       image TEXT,
       createdAt TEXT NOT NULL DEFAULT (datetime('now')),
       updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  )
}

function seedUser(id: string, name: string, email: string) {
  ensureUserTable()
  db.prepare('INSERT INTO "user" (id, name, email) VALUES (?, ?, ?)').run(id, name, email)
}

describe('admin overview', () => {
  it('agrega contagens, GMV e compras recentes', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    createStore(repo, { name: 'Mercado A' })
    createCategory(repo, { name: 'Bebidas' })
    createProduct(repo, { name: 'Café', categoryId: 'mercearia' })
    repo.purchases.create({
      userId: 'u1',
      storeId: 'store-1',
      budgetCents: 10000,
      totalCents: 4200,
      savingsCents: 100,
      itemCount: 2,
      purchasedAt: '2026-09-01T10:00:00.000Z',
    })
    const overview = getOverview(repo)
    expect(overview.counts.users).toBe(1)
    expect(overview.counts.products).toBe(1)
    expect(overview.counts.purchases).toBe(1)
    expect(overview.gmvCents).toBe(4200)
    expect(overview.recentPurchases[0]?.userName).toBe('Ana')
  })
})

describe('admin users', () => {
  it('lista com paginação e busca', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    seedUser('u2', 'Bruno', 'bruno@x.dev')
    const page = listUsers(repo, { search: 'bru', page: 1, pageSize: 10 })
    expect(page.total).toBe(1)
    expect(page.items.map((u) => u.id)).toEqual(['u2'])
  })

  it('retorna detalhe com listas, carrinhos e compras', () => {
    seedUser('u1', 'Ana', 'ana@x.dev')
    repo.lists.create({ userId: 'u1', name: 'Semana', shoppingDate: '2026-09-01' })
    repo.carts.getOrCreateActive({ userId: 'u1', storeId: 'store-1' })
    repo.purchases.create({
      userId: 'u1',
      storeId: 'store-1',
      budgetCents: 10000,
      totalCents: 4200,
      savingsCents: 0,
      itemCount: 1,
      purchasedAt: '2026-09-01T10:00:00.000Z',
    })
    const detail = getUserDetail(repo, 'u1')
    expect(detail.user.email).toBe('ana@x.dev')
    expect(detail.lists).toHaveLength(1)
    expect(detail.carts).toHaveLength(1)
    expect(detail.purchases).toHaveLength(1)
  })

  it('falha para usuário inexistente', () => {
    ensureUserTable()
    expect(() => getUserDetail(repo, 'missing')).toThrow('Usuário não encontrado.')
  })
})
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/server/services/admin-service.test.ts`
Expected: FAIL com "getOverview is not a function".

- [ ] **Step 3: Implementar overview e usuários**

No topo de `admin-service.ts`, atualize os imports de tipos (somando aos que já existem, sem duplicar):

```ts
import type { AdminUserRecord } from '../db/models'
import type { AdminOverview, AdminUserDetail, ListResult } from './admin-types'
```

Ou seja: o import de `./admin-types` passa a ser
`import type { AdminOverview, AdminProductList, AdminUserDetail, ListResult, PageFilter } from './admin-types'`,
e o import de `../db/models` passa a incluir `AdminUserRecord`.

Adicione ao final de `admin-service.ts`:

```ts
export function getOverview(repo: Repository): AdminOverview {
  return {
    counts: {
      users: repo.users.count({}),
      stores: repo.stores.adminList().length,
      products: repo.products.adminCount({}),
      categories: repo.categories.adminList().length,
      purchases: repo.purchases.adminCount(),
    },
    gmvCents: repo.purchases.adminSumTotal(),
    recentPurchases: repo.purchases.adminListRecent(8),
  }
}

export function listUsers(repo: Repository, filter: PageFilter = {}): ListResult<AdminUserRecord> {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20))
  const items = repo.users.list({
    search: filter.search,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })
  const total = repo.users.count({ search: filter.search })
  return { items, total, page, pageSize }
}

export function getUserDetail(repo: Repository, userId: string): AdminUserDetail {
  const user = repo.users.get(userId)
  if (!user) throw new Error('Usuário não encontrado.')
  return {
    user,
    lists: repo.lists.listByUser(userId),
    carts: repo.carts.listByUser(userId),
    purchases: repo.purchases.list(userId),
  }
}
```

- [ ] **Step 4: Rodar os testes para ver passar**

Run: `npx vitest run src/server/services/admin-service.test.ts`
Expected: PASS (25 testes).

- [ ] **Step 5: Rodar typecheck e lint do que foi criado**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/admin-service.ts src/server/services/admin-service.test.ts
git commit -m "feat(admin): add overview and user service"
```

---

## Task 9: Server functions do admin

**Files:**

- Create: `src/server/functions/admin.ts`
- Reference: `src/server/functions/session.ts` (padrão)

- [ ] **Step 1: Implementar as server functions**

Create `src/server/functions/admin.ts`:

```ts
import { createServerFn } from '@tanstack/react-start'
import { isAdminEmail, requireAdmin } from '../auth/admin'
import { getCurrentUser } from '../auth/session'
import type { AdminCategoryRecord, AdminProductRecord, AdminStoreRecord } from '../db/models'
import {
  createCategory,
  createProduct,
  createStore,
  deleteCategory,
  deleteProduct,
  deleteStore,
  getOverview,
  getUserDetail,
  listCategories,
  listProducts,
  listStores,
  listUsers,
  updateCategory,
  updateProduct,
  updateStore,
} from '../services/admin-service'
import type { CategoryInput, ProductInput, StoreInput } from '../services/admin-service'

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: string }

function toResult<T>(fn: () => T): AdminResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Erro inesperado.' }
  }
}

export const fetchAdminSession = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getCurrentUser()
  return { user, isAdmin: isAdminEmail(user?.email) }
})

export const fetchAdminOverview = createServerFn({ method: 'GET' }).handler(async () => {
  const { repo } = await requireAdmin()
  return getOverview(repo)
})

export const fetchAdminStores = createServerFn({ method: 'GET' }).handler(async () => {
  const { repo } = await requireAdmin()
  return listStores(repo)
})

export const fetchAdminCategories = createServerFn({ method: 'GET' }).handler(async () => {
  const { repo } = await requireAdmin()
  return listCategories(repo)
})

export const fetchAdminProducts = createServerFn({ method: 'GET' })
  .validator(
    (
      data: { search?: string; categoryId?: string; page?: number; pageSize?: number } | undefined,
    ) => data ?? {},
  )
  .handler(async ({ data }) => {
    const { repo } = await requireAdmin()
    return listProducts(repo, data)
  })

export const fetchAdminUsers = createServerFn({ method: 'GET' })
  .validator(
    (data: { search?: string; page?: number; pageSize?: number } | undefined) => data ?? {},
  )
  .handler(async ({ data }) => {
    const { repo } = await requireAdmin()
    return listUsers(repo, data)
  })

export const fetchAdminUserDetail = createServerFn({ method: 'GET' })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { repo } = await requireAdmin()
    return getUserDetail(repo, data.userId)
  })

export const createAdminStore = createServerFn({ method: 'POST' })
  .validator((data: StoreInput) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminStoreRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => createStore(repo, data))
  })

export const updateAdminStore = createServerFn({ method: 'POST' })
  .validator((data: StoreInput & { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminStoreRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => updateStore(repo, data.id, data))
  })

export const deleteAdminStore = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<{ id: string }>> => {
    const { repo } = await requireAdmin()
    return toResult(() => {
      deleteStore(repo, data.id)
      return { id: data.id }
    })
  })

export const createAdminCategory = createServerFn({ method: 'POST' })
  .validator((data: CategoryInput) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminCategoryRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => createCategory(repo, data))
  })

export const updateAdminCategory = createServerFn({ method: 'POST' })
  .validator((data: CategoryInput & { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminCategoryRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => updateCategory(repo, data.id, data))
  })

export const deleteAdminCategory = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<{ id: string }>> => {
    const { repo } = await requireAdmin()
    return toResult(() => {
      deleteCategory(repo, data.id)
      return { id: data.id }
    })
  })

export const createAdminProduct = createServerFn({ method: 'POST' })
  .validator((data: ProductInput) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminProductRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => createProduct(repo, data))
  })

export const updateAdminProduct = createServerFn({ method: 'POST' })
  .validator((data: ProductInput & { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<AdminProductRecord>> => {
    const { repo } = await requireAdmin()
    return toResult(() => updateProduct(repo, data.id, data))
  })

export const deleteAdminProduct = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<AdminResult<{ id: string }>> => {
    const { repo } = await requireAdmin()
    return toResult(() => {
      deleteProduct(repo, data.id)
      return { id: data.id }
    })
  })
```

Observação: as funções `updateAdminStore`/`updateAdminCategory`/`updateAdminProduct` passam o
objeto de dados inteiro como `input` do service; os services usam apenas os campos que conhecem,
então o `id` extra é ignorado com segurança.

- [ ] **Step 2: Rodar typecheck, lint e testes**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tudo PASS.

- [ ] **Step 3: Commit**

```bash
git add src/server/functions/admin.ts
git commit -m "feat(admin): add admin server functions"
```

---

## Task 10: Ajustar o shell raiz e a BottomNav

**Files:**

- Modify: `src/routes/__root.tsx`
- Modify: `src/components/BottomNav.tsx`

- [ ] **Step 1: Esconder a BottomNav em `/admin`**

Em `src/components/BottomNav.tsx`, altere a linha 4:

```ts
const HIDDEN_PREFIXES = ['/scanner', '/compra', '/login', '/signup', '/bem-vindo', '/admin']
```

- [ ] **Step 2: Liberar `/admin` do onboarding e do shell mobile**

Em `src/routes/__root.tsx`, atualize os imports (linha 2) para incluir `useRouterState`:

```ts
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
```

No `beforeLoad`, adicione a flag de admin e use-a para pular o onboarding. Substitua o bloco
`if (user && !isOnboarding) { ... }` (linhas ~33-38) por:

```ts
const isAdminPath = location.pathname.startsWith('/admin')
if (user && !isOnboarding && !isAdminPath) {
  const onboarding = await fetchOnboarding()
  if (!onboarding.welcomeShown) {
    throw redirect({ to: ONBOARDING_PATH })
  }
}
```

Substitua a função `RootLayout` (linhas ~105-125) por:

```tsx
function RootLayout() {
  const { user } = Route.useRouteContext()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isAdmin = pathname.startsWith('/admin')

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return (
    <AuthContext.Provider value={user}>
      {isAdmin ? (
        <Outlet />
      ) : (
        <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-surface">
          <Outlet />
          <BottomNav />
        </div>
      )}
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 3: Verificar**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/routes/__root.tsx src/components/BottomNav.tsx
git commit -m "feat(admin): render admin outside the mobile shell"
```

---

## Task 11: Primitivas de UI desktop

**Files:**

- Create: `src/components/admin/primitives.tsx`

- [ ] **Step 1: Implementar as primitivas**

Create `src/components/admin/primitives.tsx`:

```tsx
import { useEffect, type ReactNode } from 'react'
import { Icon } from '../Icon'

export const adminInputClass =
  'h-10 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none placeholder:text-outline/70 focus:border-primary focus:ring-2 focus:ring-primary/30'

export const primaryButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-on-primary transition-transform active:scale-[0.98] disabled:opacity-60'

export const ghostButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-outline-variant/50 px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60'

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">{title}</h1>
        {description && <p className="mt-1 text-sm text-on-surface-variant">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name={icon} className="text-[18px] text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="tnum mt-2 text-2xl font-extrabold text-on-surface">{value}</p>
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Icon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline"
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? 'Buscar...'}
        className={`${adminInputClass} pl-9`}
      />
    </div>
  )
}

export function AdminField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-on-surface-variant">{hint}</span>}
    </label>
  )
}

export interface AdminColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

export function AdminTable({
  columns,
  children,
  empty,
}: {
  columns: AdminColumn[]
  children: ReactNode
  empty?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant/30 bg-surface-container-low">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant ${
                    column.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {empty && (
        <div className="p-8 text-center text-sm text-on-surface-variant">Nenhum registro.</div>
      )}
    </div>
  )
}

export function AdminRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low/60">
      {children}
    </tr>
  )
}

export function AdminCell({
  children,
  align = 'left',
}: {
  children: ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <td className={`px-4 py-3 text-on-surface ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </td>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-on-surface-variant">
      <span>
        {total} registro(s) · página {page} de {pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={ghostButtonClass}
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className={ghostButtonClass}
        >
          Próxima
        </button>
      </div>
    </div>
  )
}

export function AdminModal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 cursor-default bg-inverse-surface/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-on-surface">{title}</h2>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Excluir',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AdminModal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={ghostButtonClass} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-error px-4 text-sm font-bold text-on-error transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-on-surface-variant">{message}</p>
    </AdminModal>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/primitives.tsx
git commit -m "feat(admin): add desktop UI primitives"
```

---

## Task 12: AdminShell (sidebar + topbar)

**Files:**

- Create: `src/components/admin/AdminShell.tsx`

- [ ] **Step 1: Implementar**

Create `src/components/admin/AdminShell.tsx`:

```tsx
import { useState, type ReactNode } from 'react'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { useAuthUser } from '../../auth/session-context'
import { authClient } from '../../lib/auth-client'
import { Icon } from '../Icon'
import { Logo } from '../Logo'

const NAV = [
  { to: '/admin', label: 'Visão geral', icon: 'dashboard', exact: true },
  { to: '/admin/lojas', label: 'Lojas', icon: 'storefront', exact: false },
  { to: '/admin/produtos', label: 'Produtos', icon: 'inventory_2', exact: false },
  { to: '/admin/categorias', label: 'Categorias', icon: 'category', exact: false },
  { to: '/admin/usuarios', label: 'Usuários', icon: 'group', exact: false },
] as const

export function AdminShell({ children }: { children: ReactNode }) {
  const user = useAuthUser()
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [signingOut, setSigningOut] = useState(false)

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
      await router.invalidate()
      await router.navigate({ to: '/login' })
    } finally {
      setSigningOut(false)
    }
  }

  const navLinks = (compact: boolean) => (
    <nav className={compact ? 'flex gap-1 overflow-x-auto' : 'flex flex-col gap-1'}>
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
            isActive(item)
              ? 'bg-primary-container/15 text-primary'
              : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          <Icon name={item.icon} className="text-[20px]" filled={isActive(item)} />
          {item.label}
        </Link>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-surface-container-low text-on-surface">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-outline-variant/30 bg-surface-container-lowest p-4 md:flex">
        <Link to="/admin" className="mb-6 flex items-center gap-2 px-2">
          <Logo compact />
          <div>
            <div className="text-sm font-extrabold">CarrinhoSmart</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Admin
            </div>
          </div>
        </Link>
        {navLinks(false)}
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            Voltar ao app
          </Link>
          <div className="rounded-xl bg-surface-container-low p-3">
            <div className="truncate text-xs font-bold text-on-surface">
              {user?.name ?? 'Admin'}
            </div>
            <div className="truncate text-[11px] text-on-surface-variant">{user?.email ?? ''}</div>
            <button
              type="button"
              disabled={signingOut}
              onClick={handleSignOut}
              className="mt-2 flex items-center gap-1 text-[11px] font-bold text-error disabled:opacity-60"
            >
              <Icon name="logout" className="text-[16px]" />
              {signingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 border-b border-outline-variant/30 bg-surface-container-lowest/90 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="mb-2 flex items-center justify-between">
            <Logo compact />
            <button type="button" onClick={handleSignOut} className="text-xs font-bold text-error">
              Sair
            </button>
          </div>
          {navLinks(true)}
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npm run lint`
Expected: sem erros.

Observação: `npm run typecheck` deste arquivo só passa depois que as rotas filhas
(`admin.lojas`, `admin.produtos`, `admin.categorias`, `admin.usuarios`) existirem e a árvore de
rotas for regenerada. O typecheck completo acontece no Task 18.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminShell.tsx
git commit -m "feat(admin): add desktop admin shell"
```

---

## Task 13: Rota de layout `/admin` com guard

**Files:**

- Create: `src/routes/admin.tsx`

- [ ] **Step 1: Implementar o layout e o guard**

Create `src/routes/admin.tsx`:

```tsx
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AdminShell } from '../components/admin/AdminShell'
import { fetchAdminSession } from '../server/functions/admin'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const { user, isAdmin } = await fetchAdminSession()
    if (!user) throw redirect({ to: '/login' })
    if (!isAdmin) throw redirect({ to: '/' })
    return { user }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  )
}
```

- [ ] **Step 2: Regenerar a árvore de rotas**

Run: `npm run generate-routes && npm run lint`
Expected: `src/routeTree.gen.ts` passa a incluir `/admin` e filhos. O typecheck completo fica para
o Task 18, quando todas as rotas filhas existirem.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin.tsx src/routeTree.gen.ts
git commit -m "feat(admin): add admin layout route with guard"
```

---

## Task 14: Rota de visão geral (`/admin`)

**Files:**

- Create: `src/routes/admin.index.tsx`

- [ ] **Step 1: Implementar**

Create `src/routes/admin.index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { formatBRL } from '../domain/money'
import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  StatCard,
} from '../components/admin/primitives'
import { fetchAdminOverview } from '../server/functions/admin'

export const Route = createFileRoute('/admin/')({
  loader: () => fetchAdminOverview(),
  component: AdminOverviewPage,
})

function AdminOverviewPage() {
  const overview = Route.useLoaderData()

  return (
    <div>
      <AdminPageHeader
        title="Visão geral"
        description="Resumo da base de lojas, produtos, categorias e usuários."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Usuários" value={String(overview.counts.users)} icon="group" />
        <StatCard label="Lojas" value={String(overview.counts.stores)} icon="storefront" />
        <StatCard label="Produtos" value={String(overview.counts.products)} icon="inventory_2" />
        <StatCard label="Categorias" value={String(overview.counts.categories)} icon="category" />
        <StatCard label="Compras" value={String(overview.counts.purchases)} icon="receipt_long" />
      </div>

      <div className="mt-6 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Total transacionado (GMV)
        </span>
        <p className="tnum mt-1 text-3xl font-extrabold text-primary">
          {formatBRL(overview.gmvCents)}
        </p>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold text-on-surface">Compras recentes</h2>
      <AdminTable
        columns={[
          { key: 'user', label: 'Usuário' },
          { key: 'store', label: 'Loja' },
          { key: 'items', label: 'Itens', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
          { key: 'date', label: 'Data', align: 'right' },
        ]}
        empty={overview.recentPurchases.length === 0}
      >
        {overview.recentPurchases.map((purchase) => (
          <AdminRow key={purchase.id}>
            <AdminCell>{purchase.userName || '—'}</AdminCell>
            <AdminCell>{purchase.storeName || '—'}</AdminCell>
            <AdminCell align="right">{purchase.itemCount}</AdminCell>
            <AdminCell align="right">
              <span className="tnum font-semibold">{formatBRL(purchase.totalCents)}</span>
            </AdminCell>
            <AdminCell align="right">
              {new Date(purchase.purchasedAt).toLocaleDateString('pt-BR')}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin.index.tsx src/routeTree.gen.ts
git commit -m "feat(admin): add overview page"
```

---

## Task 15: Rota de lojas (`/admin/lojas`)

**Files:**

- Create: `src/routes/admin.lojas.tsx`

- [ ] **Step 1: Implementar**

Create `src/routes/admin.lojas.tsx`:

```tsx
import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import type { AdminStoreRecord } from '../server/db/models'
import {
  AdminCell,
  AdminField,
  AdminModal,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  ConfirmDialog,
  adminInputClass,
  ghostButtonClass,
  primaryButtonClass,
} from '../components/admin/primitives'
import {
  createAdminStore,
  deleteAdminStore,
  fetchAdminStores,
  updateAdminStore,
} from '../server/functions/admin'

export const Route = createFileRoute('/admin/lojas')({
  loader: () => fetchAdminStores(),
  component: AdminStoresPage,
})

interface FormState {
  id?: string
  name: string
  city: string
}

const EMPTY: FormState = { name: '', city: '' }

function AdminStoresPage() {
  const stores = Route.useLoaderData()
  const router = useRouter()
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<AdminStoreRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form) return
    setBusy(true)
    setError(null)
    const payload = { name: form.name, city: form.city || null }
    const result = form.id
      ? await updateAdminStore({ data: { ...payload, id: form.id } })
      : await createAdminStore({ data: payload })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setForm(null)
    await router.invalidate()
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    setError(null)
    const result = await deleteAdminStore({ data: { id: deleting.id } })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDeleting(null)
    await router.invalidate()
  }

  return (
    <div>
      <AdminPageHeader
        title="Lojas"
        description="Gerencie os supermercados disponíveis para as compras."
        action={
          <button type="button" className={primaryButtonClass} onClick={() => setForm(EMPTY)}>
            Nova loja
          </button>
        }
      />

      {error && !form && !deleting && (
        <div className="mb-4 rounded-xl bg-error-container p-3 text-sm text-on-error-container">
          {error}
        </div>
      )}

      <AdminTable
        columns={[
          { key: 'name', label: 'Nome' },
          { key: 'city', label: 'Cidade' },
          { key: 'usage', label: 'Em uso', align: 'right' },
          { key: 'actions', label: '', align: 'right' },
        ]}
        empty={stores.length === 0}
      >
        {stores.map((store) => (
          <AdminRow key={store.id}>
            <AdminCell>
              <span className="font-semibold">{store.name}</span>
            </AdminCell>
            <AdminCell>{store.city ?? '—'}</AdminCell>
            <AdminCell align="right">{store.usageCount}</AdminCell>
            <AdminCell align="right">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() =>
                    setForm({ id: store.id, name: store.name, city: store.city ?? '' })
                  }
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => {
                    setError(null)
                    setDeleting(store)
                  }}
                >
                  Excluir
                </button>
              </div>
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>

      <AdminModal
        open={form !== null}
        title={form?.id ? 'Editar loja' : 'Nova loja'}
        onClose={() => {
          setForm(null)
          setError(null)
        }}
        footer={
          <>
            <button type="button" className={ghostButtonClass} onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button type="button" className={primaryButtonClass} disabled={busy} onClick={submit}>
              Salvar
            </button>
          </>
        }
      >
        {error && (
          <div className="rounded-xl bg-error-container p-3 text-sm text-on-error-container">
            {error}
          </div>
        )}
        <AdminField label="Nome">
          <input
            className={adminInputClass}
            value={form?.name ?? ''}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
            }
            placeholder="Ex.: Pão de Açúcar - Morumbi"
          />
        </AdminField>
        <AdminField label="Cidade">
          <input
            className={adminInputClass}
            value={form?.city ?? ''}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, city: event.target.value } : prev))
            }
            placeholder="Ex.: São Paulo"
          />
        </AdminField>
      </AdminModal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir loja"
        busy={busy}
        message={
          error ??
          `Tem certeza que deseja excluir "${deleting?.name ?? ''}"? Lojas em uso não podem ser excluídas.`
        }
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null)
          setError(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin.lojas.tsx src/routeTree.gen.ts
git commit -m "feat(admin): add stores management page"
```

---

## Task 16: Rota de categorias (`/admin/categorias`)

**Files:**

- Create: `src/routes/admin.categorias.tsx`

- [ ] **Step 1: Implementar**

Create `src/routes/admin.categorias.tsx`:

```tsx
import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import type { AdminCategoryRecord } from '../server/db/models'
import {
  AdminCell,
  AdminField,
  AdminModal,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  ConfirmDialog,
  adminInputClass,
  ghostButtonClass,
  primaryButtonClass,
} from '../components/admin/primitives'
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
} from '../server/functions/admin'

export const Route = createFileRoute('/admin/categorias')({
  loader: () => fetchAdminCategories(),
  component: AdminCategoriesPage,
})

const COLOR_OPTIONS = [
  { value: 'primary', label: 'Verde' },
  { value: 'secondary', label: 'Âmbar' },
  { value: 'tertiary', label: 'Terciária' },
  { value: 'outline', label: 'Neutra' },
]

interface FormState {
  id?: string
  name: string
  icon: string
  color: string
}

const EMPTY: FormState = { name: '', icon: 'category', color: 'primary' }

function AdminCategoriesPage() {
  const categories = Route.useLoaderData()
  const router = useRouter()
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<AdminCategoryRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form) return
    setBusy(true)
    setError(null)
    const payload = { name: form.name, icon: form.icon, color: form.color }
    const result = form.id
      ? await updateAdminCategory({ data: { ...payload, id: form.id } })
      : await createAdminCategory({ data: payload })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setForm(null)
    await router.invalidate()
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    setError(null)
    const result = await deleteAdminCategory({ data: { id: deleting.id } })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDeleting(null)
    await router.invalidate()
  }

  return (
    <div>
      <AdminPageHeader
        title="Categorias"
        description="Organize os produtos por categoria."
        action={
          <button type="button" className={primaryButtonClass} onClick={() => setForm(EMPTY)}>
            Nova categoria
          </button>
        }
      />

      {error && !form && !deleting && (
        <div className="mb-4 rounded-xl bg-error-container p-3 text-sm text-on-error-container">
          {error}
        </div>
      )}

      <AdminTable
        columns={[
          { key: 'icon', label: 'Ícone' },
          { key: 'name', label: 'Nome' },
          { key: 'color', label: 'Cor' },
          { key: 'references', label: 'Itens', align: 'right' },
          { key: 'actions', label: '', align: 'right' },
        ]}
        empty={categories.length === 0}
      >
        {categories.map((category) => (
          <AdminRow key={category.id}>
            <AdminCell>
              <span className="material-symbols-outlined text-[20px] text-primary">
                {category.icon}
              </span>
            </AdminCell>
            <AdminCell>
              <span className="font-semibold">{category.name}</span>
            </AdminCell>
            <AdminCell>{category.color}</AdminCell>
            <AdminCell align="right">{category.referenceCount}</AdminCell>
            <AdminCell align="right">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() =>
                    setForm({
                      id: category.id,
                      name: category.name,
                      icon: category.icon,
                      color: category.color,
                    })
                  }
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => {
                    setError(null)
                    setDeleting(category)
                  }}
                >
                  Excluir
                </button>
              </div>
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>

      <AdminModal
        open={form !== null}
        title={form?.id ? 'Editar categoria' : 'Nova categoria'}
        onClose={() => {
          setForm(null)
          setError(null)
        }}
        footer={
          <>
            <button type="button" className={ghostButtonClass} onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button type="button" className={primaryButtonClass} disabled={busy} onClick={submit}>
              Salvar
            </button>
          </>
        }
      >
        {error && (
          <div className="rounded-xl bg-error-container p-3 text-sm text-on-error-container">
            {error}
          </div>
        )}
        <AdminField label="Nome">
          <input
            className={adminInputClass}
            value={form?.name ?? ''}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
            }
            placeholder="Ex.: Bebidas"
          />
        </AdminField>
        <AdminField label="Ícone" hint="Nome de um Material Symbol (ex.: local_drink)">
          <input
            className={adminInputClass}
            value={form?.icon ?? ''}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, icon: event.target.value } : prev))
            }
          />
        </AdminField>
        <AdminField label="Cor">
          <select
            className={adminInputClass}
            value={form?.color ?? 'primary'}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, color: event.target.value } : prev))
            }
          >
            {COLOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </AdminField>
      </AdminModal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir categoria"
        busy={busy}
        message={
          error ??
          `Tem certeza que deseja excluir "${deleting?.name ?? ''}"? Categorias com produtos não podem ser excluídas.`
        }
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null)
          setError(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin.categorias.tsx src/routeTree.gen.ts
git commit -m "feat(admin): add categories management page"
```

---

## Task 17: Rota de produtos (`/admin/produtos`)

**Files:**

- Create: `src/routes/admin.produtos.tsx`

- [ ] **Step 1: Implementar**

Create `src/routes/admin.produtos.tsx`:

```tsx
import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { formatBRL, parseBRL } from '../domain/money'
import type { AdminProductRecord } from '../server/db/models'
import {
  AdminCell,
  AdminField,
  AdminModal,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  ConfirmDialog,
  Pagination,
  SearchInput,
  adminInputClass,
  ghostButtonClass,
  primaryButtonClass,
} from '../components/admin/primitives'
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminProducts,
  updateAdminProduct,
} from '../server/functions/admin'

const PAGE_SIZE = 10

interface ProductSearch {
  q?: string
  categoria?: string
  pagina?: number
}

export const Route = createFileRoute('/admin/produtos')({
  validateSearch: (search: Record<string, unknown>): ProductSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    categoria:
      typeof search.categoria === 'string' && search.categoria ? search.categoria : undefined,
    pagina: Number(search.pagina) > 0 ? Number(search.pagina) : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, categoria: search.categoria, pagina: search.pagina }),
  loader: ({ deps }) =>
    fetchAdminProducts({
      data: {
        search: deps.q,
        categoryId: deps.categoria,
        page: deps.pagina ?? 1,
        pageSize: PAGE_SIZE,
      },
    }),
  component: AdminProductsPage,
})

interface FormState {
  id?: string
  name: string
  brand: string
  barcode: string
  categoryId: string
  unit: string
  price: string
  imageUrl: string
  aisle: string
}

function AdminProductsPage() {
  const { items, total, page, pageSize, categories } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<AdminProductRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function setParam(next: Partial<ProductSearch>) {
    navigate({ search: (prev: ProductSearch) => ({ ...prev, ...next }) })
  }

  function openCreate() {
    setError(null)
    setForm({
      name: '',
      brand: '',
      barcode: '',
      categoryId: categories[0]?.id ?? '',
      unit: 'un',
      price: '',
      imageUrl: '',
      aisle: '',
    })
  }

  function openEdit(product: AdminProductRecord) {
    setError(null)
    setForm({
      id: product.id,
      name: product.name,
      brand: product.brand ?? '',
      barcode: product.barcode,
      categoryId: product.categoryId,
      unit: product.unit,
      price: (product.priceCents / 100).toFixed(2).replace('.', ','),
      imageUrl: product.imageUrl ?? '',
      aisle: product.aisle ?? '',
    })
  }

  async function submit() {
    if (!form) return
    setBusy(true)
    setError(null)
    const payload = {
      name: form.name,
      brand: form.brand || null,
      barcode: form.barcode || null,
      categoryId: form.categoryId,
      unit: form.unit,
      priceCents: parseBRL(form.price),
      imageUrl: form.imageUrl || null,
      aisle: form.aisle || null,
    }
    const result = form.id
      ? await updateAdminProduct({ data: { ...payload, id: form.id } })
      : await createAdminProduct({ data: payload })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setForm(null)
    await router.invalidate()
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    setError(null)
    const result = await deleteAdminProduct({ data: { id: deleting.id } })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDeleting(null)
    await router.invalidate()
  }

  return (
    <div>
      <AdminPageHeader
        title="Produtos"
        description="Catálogo compartilhado usado pelo scanner e pelas listas."
        action={
          <button type="button" className={primaryButtonClass} onClick={openCreate}>
            Novo produto
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search.q ?? ''}
          placeholder="Buscar por nome ou marca"
          onChange={(value) => setParam({ q: value || undefined, pagina: undefined })}
        />
        <select
          className={`${adminInputClass} max-w-xs`}
          value={search.categoria ?? ''}
          onChange={(event) =>
            setParam({ categoria: event.target.value || undefined, pagina: undefined })
          }
        >
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {error && !form && !deleting && (
        <div className="mb-4 rounded-xl bg-error-container p-3 text-sm text-on-error-container">
          {error}
        </div>
      )}

      <AdminTable
        columns={[
          { key: 'name', label: 'Produto' },
          { key: 'category', label: 'Categoria' },
          { key: 'barcode', label: 'Código' },
          { key: 'price', label: 'Preço', align: 'right' },
          { key: 'usage', label: 'Em uso', align: 'right' },
          { key: 'actions', label: '', align: 'right' },
        ]}
        empty={items.length === 0}
      >
        {items.map((product) => (
          <AdminRow key={product.id}>
            <AdminCell>
              <div className="font-semibold">{product.name}</div>
              <div className="text-[11px] text-on-surface-variant">{product.brand ?? '—'}</div>
            </AdminCell>
            <AdminCell>{product.categoryName}</AdminCell>
            <AdminCell>
              <span className="tnum text-xs">{product.barcode}</span>
            </AdminCell>
            <AdminCell align="right">
              <span className="tnum font-semibold">{formatBRL(product.priceCents)}</span>
            </AdminCell>
            <AdminCell align="right">{product.usageCount}</AdminCell>
            <AdminCell align="right">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => openEdit(product)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => {
                    setError(null)
                    setDeleting(product)
                  }}
                >
                  Excluir
                </button>
              </div>
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={(next) => setParam({ pagina: next === 1 ? undefined : next })}
      />

      <AdminModal
        open={form !== null}
        title={form?.id ? 'Editar produto' : 'Novo produto'}
        onClose={() => {
          setForm(null)
          setError(null)
        }}
        footer={
          <>
            <button type="button" className={ghostButtonClass} onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button type="button" className={primaryButtonClass} disabled={busy} onClick={submit}>
              Salvar
            </button>
          </>
        }
      >
        {error && (
          <div className="rounded-xl bg-error-container p-3 text-sm text-on-error-container">
            {error}
          </div>
        )}
        <AdminField label="Nome">
          <input
            className={adminInputClass}
            value={form?.name ?? ''}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
            }
          />
        </AdminField>
        <div className="grid grid-cols-2 gap-4">
          <AdminField label="Marca">
            <input
              className={adminInputClass}
              value={form?.brand ?? ''}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, brand: event.target.value } : prev))
              }
            />
          </AdminField>
          <AdminField label="Categoria">
            <select
              className={adminInputClass}
              value={form?.categoryId ?? ''}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, categoryId: event.target.value } : prev))
              }
            >
              <option value="">Selecione</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Preço (R$)">
            <input
              className={adminInputClass}
              value={form?.price ?? ''}
              placeholder="0,00"
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, price: event.target.value } : prev))
              }
            />
          </AdminField>
          <AdminField label="Unidade">
            <select
              className={adminInputClass}
              value={form?.unit ?? 'un'}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, unit: event.target.value } : prev))
              }
            >
              <option value="un">Unidade</option>
              <option value="kg">Quilo</option>
              <option value="L">Litro</option>
            </select>
          </AdminField>
        </div>
        <AdminField label="Código de barras" hint="EAN-13. Em branco gera um código interno.">
          <input
            className={adminInputClass}
            value={form?.barcode ?? ''}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, barcode: event.target.value } : prev))
            }
          />
        </AdminField>
        <div className="grid grid-cols-2 gap-4">
          <AdminField label="Corredor">
            <input
              className={adminInputClass}
              value={form?.aisle ?? ''}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, aisle: event.target.value } : prev))
              }
            />
          </AdminField>
          <AdminField label="URL da imagem">
            <input
              className={adminInputClass}
              value={form?.imageUrl ?? ''}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, imageUrl: event.target.value } : prev))
              }
            />
          </AdminField>
        </div>
      </AdminModal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir produto"
        busy={busy}
        message={
          error ??
          `Tem certeza que deseja excluir "${deleting?.name ?? ''}"? Produtos em uso não podem ser excluídos.`
        }
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null)
          setError(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin.produtos.tsx src/routeTree.gen.ts
git commit -m "feat(admin): add products management page"
```

---

## Task 18: Rotas de usuários (lista e detalhe)

**Files:**

- Create: `src/routes/admin.usuarios.tsx`
- Create: `src/routes/admin.usuarios.$userId.tsx`

- [ ] **Step 1: Implementar a lista**

Create `src/routes/admin.usuarios.tsx`:

```tsx
import { Link, createFileRoute } from '@tanstack/react-router'
import { formatBRL } from '../domain/money'
import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  Pagination,
  SearchInput,
} from '../components/admin/primitives'
import { fetchAdminUsers } from '../server/functions/admin'

const PAGE_SIZE = 20

interface UserSearch {
  q?: string
  pagina?: number
}

export const Route = createFileRoute('/admin/usuarios')({
  validateSearch: (search: Record<string, unknown>): UserSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    pagina: Number(search.pagina) > 0 ? Number(search.pagina) : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, pagina: search.pagina }),
  loader: ({ deps }) =>
    fetchAdminUsers({
      data: { search: deps.q, page: deps.pagina ?? 1, pageSize: PAGE_SIZE },
    }),
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const { items, total, page, pageSize } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <div>
      <AdminPageHeader
        title="Usuários"
        description="Contas cadastradas e seus indicadores de uso."
      />

      <div className="mb-4">
        <SearchInput
          value={search.q ?? ''}
          placeholder="Buscar por nome ou e-mail"
          onChange={(value) =>
            navigate({
              search: (prev: UserSearch) => ({ ...prev, q: value || undefined, pagina: undefined }),
            })
          }
        />
      </div>

      <AdminTable
        columns={[
          { key: 'name', label: 'Usuário' },
          { key: 'lists', label: 'Listas', align: 'right' },
          { key: 'carts', label: 'Carrinhos', align: 'right' },
          { key: 'purchases', label: 'Compras', align: 'right' },
          { key: 'spent', label: 'Total gasto', align: 'right' },
          { key: 'detail', label: '', align: 'right' },
        ]}
        empty={items.length === 0}
      >
        {items.map((user) => (
          <AdminRow key={user.id}>
            <AdminCell>
              <div className="font-semibold">{user.name}</div>
              <div className="text-[11px] text-on-surface-variant">{user.email}</div>
            </AdminCell>
            <AdminCell align="right">{user.listCount}</AdminCell>
            <AdminCell align="right">{user.cartCount}</AdminCell>
            <AdminCell align="right">{user.purchaseCount}</AdminCell>
            <AdminCell align="right">
              <span className="tnum font-semibold">{formatBRL(user.totalSpentCents)}</span>
            </AdminCell>
            <AdminCell align="right">
              <Link
                to="/admin/usuarios/$userId"
                params={{ userId: user.id }}
                className="text-sm font-bold text-primary hover:underline"
              >
                Ver
              </Link>
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={(next) =>
          navigate({
            search: (prev: UserSearch) => ({ ...prev, pagina: next === 1 ? undefined : next }),
          })
        }
      />
    </div>
  )
}
```

- [ ] **Step 2: Implementar o detalhe**

Create `src/routes/admin.usuarios.$userId.tsx`:

```tsx
import { Link, createFileRoute } from '@tanstack/react-router'
import { formatBRL } from '../domain/money'
import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  StatCard,
} from '../components/admin/primitives'
import { fetchAdminUserDetail } from '../server/functions/admin'

export const Route = createFileRoute('/admin/usuarios/$userId')({
  loader: ({ params }) => fetchAdminUserDetail({ data: { userId: params.userId } }),
  component: AdminUserDetailPage,
})

function AdminUserDetailPage() {
  const { user, lists, carts, purchases } = Route.useLoaderData()

  return (
    <div>
      <Link to="/admin/usuarios" className="text-sm font-semibold text-primary hover:underline">
        ← Voltar para usuários
      </Link>
      <div className="mt-3">
        <AdminPageHeader title={user.name} description={user.email} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Listas" value={String(user.listCount)} icon="checklist" />
        <StatCard label="Carrinhos" value={String(user.cartCount)} icon="shopping_cart" />
        <StatCard label="Compras" value={String(user.purchaseCount)} icon="receipt_long" />
        <StatCard label="Total gasto" value={formatBRL(user.totalSpentCents)} icon="payments" />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold text-on-surface">Compras</h2>
      <AdminTable
        columns={[
          { key: 'store', label: 'Loja' },
          { key: 'items', label: 'Itens', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
          { key: 'date', label: 'Data', align: 'right' },
        ]}
        empty={purchases.length === 0}
      >
        {purchases.map((purchase) => (
          <AdminRow key={purchase.id}>
            <AdminCell>{purchase.storeName || '—'}</AdminCell>
            <AdminCell align="right">{purchase.itemCount}</AdminCell>
            <AdminCell align="right">
              <span className="tnum font-semibold">{formatBRL(purchase.totalCents)}</span>
            </AdminCell>
            <AdminCell align="right">
              {new Date(purchase.purchasedAt).toLocaleDateString('pt-BR')}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>

      <h2 className="mb-3 mt-8 text-lg font-bold text-on-surface">Listas e carrinhos</h2>
      <AdminTable
        columns={[
          { key: 'type', label: 'Tipo' },
          { key: 'name', label: 'Descrição' },
          { key: 'status', label: 'Status' },
          { key: 'date', label: 'Criado em', align: 'right' },
        ]}
        empty={lists.length === 0 && carts.length === 0}
      >
        {lists.map((list) => (
          <AdminRow key={list.id}>
            <AdminCell>Lista</AdminCell>
            <AdminCell>{list.name}</AdminCell>
            <AdminCell>{list.status}</AdminCell>
            <AdminCell align="right">
              {new Date(list.shoppingDate).toLocaleDateString('pt-BR')}
            </AdminCell>
          </AdminRow>
        ))}
        {carts.map((cart) => (
          <AdminRow key={cart.id}>
            <AdminCell>Carrinho</AdminCell>
            <AdminCell>{formatBRL(cart.budgetCents)} de orçamento</AdminCell>
            <AdminCell>{cart.status}</AdminCell>
            <AdminCell align="right">
              {new Date(cart.createdAt).toLocaleDateString('pt-BR')}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </div>
  )
}
```

- [ ] **Step 3: Regenerar rotas, verificar e commitar**

Run: `npm run generate-routes && npm run typecheck && npm run lint`
Expected: sem erros.

```bash
git add src/routes/admin.usuarios.tsx 'src/routes/admin.usuarios.$userId.tsx' src/routeTree.gen.ts
git commit -m "feat(admin): add users list and detail pages"
```

---

## Task 19: Env, README, spec e verificação final

**Files:**

- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-20-admin-panel-design.md`

- [ ] **Step 1: Documentar a variável de ambiente**

Adicione ao final de `.env.example`:

```
# Painel admin — lista de e-mails (CSV, separados por vírgula) com acesso a /admin.
# Se ausente ou vazia, o painel fica desabilitado para todos.
ADMIN_EMAILS=demo@carrinhosmart.dev
```

- [ ] **Step 2: Documentar no README**

Adicione uma seção `## Painel admin` ao `README.md` (perto das seções de uso/configuração) com o
conteúdo:

```markdown
## Painel admin

Área administrativa desktop em `/admin` para gerenciar **lojas**, **produtos** e **categorias**
(CRUD completo) e consultar **usuários** (somente leitura: listas, carrinhos e compras).

O acesso é controlado por uma allowlist de e-mails na variável de ambiente `ADMIN_EMAILS`
(CSV, sem espaços obrigatórios). Se a variável estiver ausente ou vazia, ninguém acessa o painel
(fail-closed).
```

ADMIN_EMAILS=voce@exemplo.com,outro@exemplo.com

```

O usuário precisa estar autenticado com um e-mail presente na lista; caso contrário é
redirecionado para `/`. O admin não passa pela tela de onboarding `/bem-vindo`.

Regras: lojas, produtos e categorias **não podem ser excluídos quando estão em uso** (carrinhos,
listas, compras ou histórico de preço); a UI exibe o motivo. Produtos sem código de barras recebem
um código interno (`INT-...`).
```

- [ ] **Step 3: Corrigir a spec sobre `barcode`**

Em `docs/superpowers/specs/2026-09-20-admin-panel-design.md`, no item "Exclusão de produto/loja/
categoria" e na seção "Repositórios", substitua a menção a barcode `NULL` por:

```markdown
- `products.barcode` é `TEXT NOT NULL UNIQUE`; quando o admin não informa código de barras, o
  service gera um código interno único `INT-<10 hex>`. Quando informado, normaliza e, se tiver 13
  dígitos, exige EAN-13 válido e unicidade.
```

- [ ] **Step 4: Verificação final completa (gate de qualidade do CI)**

Run: `npm run generate-routes && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`
Expected: todos os comandos PASS, 0 warnings de lint, 0 erros de tipo, todos os testes verdes e
build concluído.

Se `format:check` falhar:
Run: `npm run format` e re-rode a verificação.

- [ ] **Step 5: Smoke manual (opcional, recomendado)**

1. Defina `ADMIN_EMAILS=demo@carrinhosmart.dev` no ambiente e rode `npm run dev`.
2. Faça login com `demo@carrinhosmart.dev` / `demo12345`.
3. Acesse `http://localhost:3000/admin` e confirme: sidebar desktop, dashboard, CRUD de lojas,
   produtos (com busca/filtro/paginação) e categorias, e leitura de usuários.
4. Tente excluir um produto em uso e confirme a mensagem de bloqueio.
5. Faça logout pelo shell admin e confirme o retorno a `/login`.
6. Remova `ADMIN_EMAILS` e confirme que `/admin` redireciona para `/`.

- [ ] **Step 6: Commit**

```bash
git add .env.example README.md docs/superpowers/specs/2026-09-20-admin-panel-design.md
git commit -m "docs(admin): document ADMIN_EMAILS and admin panel"
```

- [ ] **Step 7: Abrir PR**

```bash
git push -u origin feat/admin-panel
gh pr create --title "feat(admin): painel admin desktop" --body "Adiciona /admin com autorização por ADMIN_EMAILS e CRUD de lojas, produtos e categorias, além de leitura de usuários. Ver spec em docs/superpowers/specs/2026-09-20-admin-panel-design.md e plano em docs/superpowers/plans/2026-09-20-admin-panel.md."
```

---

## Cobertura da spec

| Requisito da spec                                                    | Task        |
| -------------------------------------------------------------------- | ----------- |
| Allowlist `ADMIN_EMAILS`, fail-closed, `requireAdmin`                | 1           |
| Rotas `/admin` + guard + shell desktop fora do `max-w-lg`            | 10, 12, 13  |
| Visão geral com contagens, GMV, compras recentes                     | 4, 5, 8, 14 |
| CRUD de lojas + bloqueio de exclusão em uso                          | 3, 6, 15    |
| CRUD de produtos + validação/EAN + bloqueio de exclusão              | 3, 4, 7, 17 |
| CRUD de categorias + bloqueio de exclusão                            | 3, 6, 16    |
| Usuários somente leitura (lista + detalhe)                           | 5, 8, 18    |
| IDs por slug + unicidade                                             | 2, 6, 7     |
| Testes de service, repositório e allowlist                           | 1–8         |
| Docs/env                                                             | 19          |
| Fora do escopo (editar usuários, papéis, upload, auditoria, estoque) | —           |
