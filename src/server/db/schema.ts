import {
  CATALOG_EXTRA_PRODUCTS,
  CATALOG_REAL_PRODUCTS,
  CATALOG_SYNTHETIC_PRODUCT_IDS,
} from './catalog-barcodes'

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'category',
  color TEXT NOT NULL DEFAULT 'primary'
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  category_id TEXT NOT NULL REFERENCES categories(id),
  unit TEXT NOT NULL DEFAULT 'un',
  price_cents INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  aisle TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  shopping_date TEXT NOT NULL,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user ON shopping_lists(user_id);

CREATE TABLE IF NOT EXISTS list_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  aisle TEXT,
  expected_price_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  quantity REAL NOT NULL DEFAULT 1,
  scanned_price_cents INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_product ON list_items(product_id);
CREATE INDEX IF NOT EXISTS idx_list_items_category ON list_items(category_id);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id),
  list_id TEXT REFERENCES shopping_lists(id),
  budget_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_carts_user_status ON carts(user_id, status);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  list_item_id TEXT REFERENCES list_items(id),
  barcode TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category_id TEXT NOT NULL,
  image_url TEXT,
  unit TEXT NOT NULL DEFAULT 'un',
  unit_price_cents INTEGER NOT NULL,
  list_price_cents INTEGER NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  promo INTEGER NOT NULL DEFAULT 0,
  is_weighed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id),
  list_id TEXT REFERENCES shopping_lists(id),
  budget_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  savings_cents INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  purchased_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchases_user_date ON purchases(user_id, purchased_at);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchased_at);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  total_cents INTEGER NOT NULL,
  was_promo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);

CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id TEXT REFERENCES stores(id),
  price_cents INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_price_history_user_product ON price_history(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  demo_data_seeded INTEGER NOT NULL DEFAULT 0,
  welcome_shown INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

export interface MigratableStatement {
  all(...params: unknown[]): Array<Record<string, unknown>>
  run(...params: unknown[]): unknown
}

export interface MigratableDatabase {
  exec(sql: string): unknown
  prepare(sql: string): MigratableStatement
}

const USER_SCOPED_COLUMNS: Array<{ table: string; column: string; ddl: string }> = [
  { table: 'shopping_lists', column: 'user_id', ddl: "user_id TEXT NOT NULL DEFAULT ''" },
  { table: 'carts', column: 'user_id', ddl: "user_id TEXT NOT NULL DEFAULT ''" },
  { table: 'purchases', column: 'user_id', ddl: "user_id TEXT NOT NULL DEFAULT ''" },
  { table: 'price_history', column: 'user_id', ddl: "user_id TEXT NOT NULL DEFAULT ''" },
]

function hasColumn(db: MigratableDatabase, table: string, column: string): boolean {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((row) => row.name === column)
}

function ensureColumns(db: MigratableDatabase): void {
  for (const { table, column, ddl } of USER_SCOPED_COLUMNS) {
    if (!hasColumn(db, table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
    }
  }
}

/**
 * Bancos criados antes da inclusão de EAN-13 válido usavam códigos sequenciais
 * (`7891000000001`). Regenera o dígito verificador para um EAN-13 válido.
 */
function fixLegacyBarcodes(db: MigratableDatabase): void {
  const rows = db
    .prepare("SELECT id, barcode FROM products WHERE barcode LIKE '7891000000%'")
    .all() as Array<{
    id: string
    barcode: string
  }>

  for (const row of rows) {
    const digits = String(row.barcode).replace(/\D/g, '')
    if (digits.length !== 13) continue
    const prefix = digits.slice(0, 12)
    let sum = 0
    for (let index = 0; index < 12; index += 1) {
      sum += Number(prefix[index]) * (index % 2 === 0 ? 1 : 3)
    }
    const fixed = `${prefix}${(10 - (sum % 10)) % 10}`
    if (fixed !== row.barcode) {
      db.exec(`UPDATE products SET barcode = '${fixed}' WHERE id = '${row.id}'`)
    }
  }
}

/**
 * Substitui os códigos sintéticos do catálogo pelos EAN-13 reais conhecidos,
 * mantendo a operação idempotente e sem sobrescrever códigos já usados.
 */
function upgradeCatalogBarcodes(db: MigratableDatabase): void {
  for (const [id, product] of Object.entries(CATALOG_REAL_PRODUCTS)) {
    const current = db.prepare('SELECT barcode FROM products WHERE id = ?').all(id)
    if (current.length === 0) continue
    if (String(current[0].barcode) === product.barcode) continue
    const taken = db.prepare('SELECT id FROM products WHERE barcode = ?').all(product.barcode)
    if (taken.length > 0) continue
    db.prepare('UPDATE products SET barcode = ?, brand = ? WHERE id = ?').run(
      product.barcode,
      product.brand,
      id,
    )
  }
}

/**
 * Remove do catálogo os produtos antigos sem EAN-13 real, apenas se ainda
 * estiverem com o código sintético (preserva itens editados manualmente).
 */
function removeSyntheticCatalogProducts(db: MigratableDatabase): void {
  for (const id of CATALOG_SYNTHETIC_PRODUCT_IDS) {
    const present = db
      .prepare("SELECT id FROM products WHERE id = ? AND barcode LIKE '7891000000%'")
      .all(id)
    if (present.length === 0) continue
    db.prepare('UPDATE list_items SET product_id = NULL WHERE product_id = ?').run(id)
    db.prepare('UPDATE cart_items SET product_id = NULL WHERE product_id = ?').run(id)
    db.prepare('UPDATE purchase_items SET product_id = NULL WHERE product_id = ?').run(id)
    db.prepare('DELETE FROM products WHERE id = ?').run(id)
  }
}

/**
 * Insere produtos extras do catálogo (com EAN real) quando ainda não existem.
 * Só roda se a categoria já estiver cadastrada, para não violar a FK no boot inicial.
 */
function insertMissingCatalogProducts(db: MigratableDatabase): void {
  for (const product of CATALOG_EXTRA_PRODUCTS) {
    const exists = db.prepare('SELECT id FROM products WHERE id = ?').all(product.id)
    if (exists.length > 0) continue
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').all(product.categoryId)
    if (category.length === 0) continue
    const barcodeTaken = db
      .prepare('SELECT id FROM products WHERE barcode = ?')
      .all(product.barcode)
    if (barcodeTaken.length > 0) continue
    db.prepare(
      `INSERT INTO products (id, barcode, name, brand, category_id, unit, price_cents, image_url, aisle)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).run(
      product.id,
      product.barcode,
      product.name,
      product.brand,
      product.categoryId,
      product.unit,
      product.priceCents,
      product.aisle,
    )
  }
}

export function migrate(db: MigratableDatabase): void {
  db.exec(SCHEMA_SQL)
  ensureColumns(db)
  fixLegacyBarcodes(db)
  upgradeCatalogBarcodes(db)
  removeSyntheticCatalogProducts(db)
  insertMissingCatalogProducts(db)
}
