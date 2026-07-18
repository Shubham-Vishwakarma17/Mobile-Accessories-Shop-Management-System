import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id),
      variant_name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      qr_value TEXT NOT NULL UNIQUE,
      purchase_price_paise INTEGER NOT NULL CHECK(purchase_price_paise >= 0),
      selling_price_paise INTEGER NOT NULL CHECK(selling_price_paise >= 0),
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),
      low_stock_threshold INTEGER NOT NULL DEFAULT 3 CHECK(low_stock_threshold >= 0),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('DRAFT', 'COMPLETED', 'CANCELLED')),
      payment_method TEXT,
      total_paise INTEGER NOT NULL DEFAULT 0,
      total_cost_paise INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY NOT NULL,
      sale_id TEXT NOT NULL REFERENCES sales(id),
      variant_id TEXT NOT NULL REFERENCES variants(id),
      product_name_snapshot TEXT NOT NULL,
      variant_name_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price_paise INTEGER NOT NULL,
      unit_cost_paise INTEGER NOT NULL,
      UNIQUE(sale_id, variant_id)
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY NOT NULL,
      variant_id TEXT NOT NULL REFERENCES variants(id),
      type TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      stock_before INTEGER NOT NULL,
      stock_after INTEGER NOT NULL,
      sale_id TEXT,
      reason TEXT,
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      operation_id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS variants_product_id_idx ON variants(product_id);
    CREATE INDEX IF NOT EXISTS sales_status_idx ON sales(status);
    CREATE INDEX IF NOT EXISTS movements_variant_id_idx ON inventory_movements(variant_id);
  `);

  await seedDatabase(db);
}

async function seedDatabase(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM products');
  if ((row?.count ?? 0) > 0) return;

  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO products (id, name, category, brand, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      'demo-product-cover', 'iPhone 17 Cover', 'Phone Covers', 'Generic', now, now,
    );
    await db.runAsync(
      `INSERT INTO variants
       (id, product_id, variant_name, sku, qr_value, purchase_price_paise, selling_price_paise, stock_quantity, low_stock_threshold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'demo-variant-pro-black', 'demo-product-cover', 'Pro / Black', 'IP17-PRO-BLK',
      'MASMS:VARIANT:demo-variant-pro-black', 25000, 49900, 8, 3, now, now,
    );
    await db.runAsync(
      `INSERT INTO variants
       (id, product_id, variant_name, sku, qr_value, purchase_price_paise, selling_price_paise, stock_quantity, low_stock_threshold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'demo-variant-max-blue', 'demo-product-cover', 'Pro Max / Blue', 'IP17-PM-BLU',
      'MASMS:VARIANT:demo-variant-max-blue', 27500, 54900, 2, 3, now, now,
    );
  });
}
