import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { DashboardSummary, DraftSale, InventoryVariant, PaymentMethod } from '@/types/domain';

const id = () => Crypto.randomUUID();

export async function getDashboardSummary(db: SQLiteDatabase): Promise<DashboardSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const [stock, sales, draft] = await Promise.all([
    db.getFirstAsync<{ total: number; low: number; out: number }>(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) AS low,
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out
      FROM variants WHERE is_active = 1
    `),
    db.getFirstAsync<{ count: number; revenue: number }>(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total_paise), 0) AS revenue
       FROM sales WHERE status = 'COMPLETED' AND substr(completed_at, 1, 10) = ?`, today,
    ),
    db.getFirstAsync<{ count: number }>(`
      SELECT COALESCE(SUM(si.quantity), 0) AS count FROM sale_items si
      JOIN sales s ON s.id = si.sale_id WHERE s.status = 'DRAFT'
    `),
  ]);
  return {
    todayRevenuePaise: sales?.revenue ?? 0,
    todaySales: sales?.count ?? 0,
    totalVariants: stock?.total ?? 0,
    lowStock: stock?.low ?? 0,
    outOfStock: stock?.out ?? 0,
    draftItems: draft?.count ?? 0,
  };
}

export async function listVariants(db: SQLiteDatabase): Promise<InventoryVariant[]> {
  return db.getAllAsync<InventoryVariant>(`
    SELECT v.id, v.product_id AS productId, p.name AS productName,
      v.variant_name AS variantName, v.sku, v.qr_value AS qrValue,
      v.purchase_price_paise AS purchasePricePaise,
      v.selling_price_paise AS sellingPricePaise,
      v.stock_quantity AS stockQuantity,
      v.low_stock_threshold AS lowStockThreshold
    FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.is_active = 1 AND p.is_active = 1
    ORDER BY p.name, v.variant_name
  `);
}

export async function getVariantById(db: SQLiteDatabase, variantId: string): Promise<InventoryVariant | null> {
  return db.getFirstAsync<InventoryVariant>(`
    SELECT v.id, v.product_id AS productId, p.name AS productName,
      v.variant_name AS variantName, v.sku, v.qr_value AS qrValue,
      v.purchase_price_paise AS purchasePricePaise,
      v.selling_price_paise AS sellingPricePaise,
      v.stock_quantity AS stockQuantity,
      v.low_stock_threshold AS lowStockThreshold
    FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.id = ? AND v.is_active = 1
  `, variantId);
}

export async function findVariantByQr(db: SQLiteDatabase, qrValue: string) {
  return db.getFirstAsync<InventoryVariant>(`
    SELECT v.id, v.product_id AS productId, p.name AS productName,
      v.variant_name AS variantName, v.sku, v.qr_value AS qrValue,
      v.purchase_price_paise AS purchasePricePaise,
      v.selling_price_paise AS sellingPricePaise,
      v.stock_quantity AS stockQuantity,
      v.low_stock_threshold AS lowStockThreshold
    FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.qr_value = ? AND v.is_active = 1
  `, qrValue);
}

export async function addVariantQuantityToDraft(db: SQLiteDatabase, variantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Select at least one piece.');
  const variant = await getVariantById(db, variantId);
  if (!variant) throw new Error('This product could not be found.');
  if (variant.stockQuantity < quantity) throw new Error(`Only ${variant.stockQuantity} pieces are available.`);

  await db.withTransactionAsync(async () => {
    let sale = await db.getFirstAsync<{ id: string }>("SELECT id FROM sales WHERE status = 'DRAFT' LIMIT 1");
    if (!sale) {
      sale = { id: id() };
      await db.runAsync("INSERT INTO sales (id, status, created_at) VALUES (?, 'DRAFT', ?)", sale.id, new Date().toISOString());
    }
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM sale_items WHERE sale_id = ? AND variant_id = ?', sale.id, variant.id,
    );
    if (existing) {
      await db.runAsync('UPDATE sale_items SET quantity = quantity + ? WHERE id = ?', quantity, existing.id);
    } else {
      await db.runAsync(
        `INSERT INTO sale_items
         (id, sale_id, variant_id, product_name_snapshot, variant_name_snapshot, quantity, unit_price_paise, unit_cost_paise)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id(), sale.id, variant.id, variant.productName, variant.variantName, quantity,
        variant.sellingPricePaise, variant.purchasePricePaise,
      );
    }
    const now = new Date().toISOString();
    await db.runAsync("UPDATE variants SET stock_quantity = stock_quantity - ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?", quantity, now, variant.id);
    await db.runAsync(
      `INSERT INTO inventory_movements
       (id, variant_id, type, quantity_change, stock_before, stock_after, sale_id, created_at)
       VALUES (?, ?, 'SALE_RESERVED', ?, ?, ?, ?, ?)`,
      id(), variant.id, -quantity, variant.stockQuantity, variant.stockQuantity - quantity, sale.id, now,
    );
  });
}

export async function addStock(db: SQLiteDatabase, variantId: string, quantity: number, reason?: string) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Enter how many new pieces arrived.');
  const variant = await getVariantById(db, variantId);
  if (!variant) throw new Error('This product could not be found.');
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE variants SET stock_quantity = stock_quantity + ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?",
      quantity, now, variantId,
    );
    await db.runAsync(
      `INSERT INTO inventory_movements
       (id, variant_id, type, quantity_change, stock_before, stock_after, reason, created_at)
       VALUES (?, ?, 'STOCK_RECEIVED', ?, ?, ?, ?, ?)`,
      id(), variantId, quantity, variant.stockQuantity, variant.stockQuantity + quantity,
      reason?.trim() || 'New stock arrived', now,
    );
    await queueSync(db, 'variant', variantId, 'UPDATE_STOCK', { quantity, reason });
  });
  return variant.stockQuantity + quantity;
}

type NewVariantInput = {
  productName: string;
  category: string;
  brand?: string;
  variantName: string;
  sku: string;
  purchasePricePaise: number;
  sellingPricePaise: number;
  stockQuantity: number;
  lowStockThreshold: number;
};

export async function createProductWithVariant(db: SQLiteDatabase, input: NewVariantInput) {
  const productId = id();
  const variantId = id();
  const now = new Date().toISOString();
  const qrValue = `MASMS:VARIANT:${variantId}`;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO products (id, name, category, brand, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      productId, input.productName.trim(), input.category.trim(), input.brand?.trim() || null, now, now,
    );
    await db.runAsync(
      `INSERT INTO variants
       (id, product_id, variant_name, sku, qr_value, purchase_price_paise, selling_price_paise, stock_quantity, low_stock_threshold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      variantId, productId, input.variantName.trim(), input.sku.trim().toUpperCase(), qrValue,
      input.purchasePricePaise, input.sellingPricePaise, input.stockQuantity,
      input.lowStockThreshold, now, now,
    );
    await queueSync(db, 'product', productId, 'CREATE', input);
  });
  return { productId, variantId, qrValue };
}

export async function addScannedVariant(db: SQLiteDatabase, qrValue: string) {
  let message = '';
  await db.withTransactionAsync(async () => {
    const variant = await db.getFirstAsync<InventoryVariant>(`
      SELECT v.id, v.product_id AS productId, p.name AS productName,
        v.variant_name AS variantName, v.sku, v.qr_value AS qrValue,
        v.purchase_price_paise AS purchasePricePaise,
        v.selling_price_paise AS sellingPricePaise,
        v.stock_quantity AS stockQuantity, v.low_stock_threshold AS lowStockThreshold
      FROM variants v JOIN products p ON p.id = v.product_id WHERE v.qr_value = ?
    `, qrValue);
    if (!variant) throw new Error('This QR code does not belong to a product in this shop.');
    if (variant.stockQuantity <= 0) throw new Error(`${variant.productName} is out of stock.`);

    let sale = await db.getFirstAsync<{ id: string }>("SELECT id FROM sales WHERE status = 'DRAFT' LIMIT 1");
    if (!sale) {
      sale = { id: id() };
      await db.runAsync(
        "INSERT INTO sales (id, status, created_at) VALUES (?, 'DRAFT', ?)", sale.id, new Date().toISOString(),
      );
    }
    const existing = await db.getFirstAsync<{ id: string; quantity: number }>(
      'SELECT id, quantity FROM sale_items WHERE sale_id = ? AND variant_id = ?', sale.id, variant.id,
    );
    if (existing) {
      await db.runAsync('UPDATE sale_items SET quantity = quantity + 1 WHERE id = ?', existing.id);
    } else {
      await db.runAsync(
        `INSERT INTO sale_items
         (id, sale_id, variant_id, product_name_snapshot, variant_name_snapshot, quantity, unit_price_paise, unit_cost_paise)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        id(), sale.id, variant.id, variant.productName, variant.variantName,
        variant.sellingPricePaise, variant.purchasePricePaise,
      );
    }
    await db.runAsync('UPDATE variants SET stock_quantity = stock_quantity - 1, updated_at = ? WHERE id = ?', new Date().toISOString(), variant.id);
    await db.runAsync(
      `INSERT INTO inventory_movements
       (id, variant_id, type, quantity_change, stock_before, stock_after, sale_id, created_at)
       VALUES (?, ?, 'SALE_RESERVED', -1, ?, ?, ?, ?)`,
      id(), variant.id, variant.stockQuantity, variant.stockQuantity - 1, sale.id, new Date().toISOString(),
    );
    message = `${variant.productName} · ${variant.variantName}`;
  });
  return message;
}

export async function getDraftSale(db: SQLiteDatabase): Promise<DraftSale | null> {
  const sale = await db.getFirstAsync<{ id: string }>("SELECT id FROM sales WHERE status = 'DRAFT' LIMIT 1");
  if (!sale) return null;
  const items = await db.getAllAsync<DraftSale['items'][number]>(`
    SELECT id, product_name_snapshot AS productName, variant_name_snapshot AS variantName,
      quantity, unit_price_paise AS unitPricePaise,
      quantity * unit_price_paise AS lineTotalPaise
    FROM sale_items WHERE sale_id = ? ORDER BY rowid DESC
  `, sale.id);
  return {
    id: sale.id,
    items,
    totalPaise: items.reduce((sum, item) => sum + item.lineTotalPaise, 0),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export async function completeDraftSale(db: SQLiteDatabase, paymentMethod: PaymentMethod) {
  const draft = await getDraftSale(db);
  if (!draft || draft.itemCount === 0) throw new Error('Scan at least one item before completing the sale.');
  const cost = await db.getFirstAsync<{ total: number }>(`
    SELECT SUM(quantity * unit_cost_paise) AS total FROM sale_items WHERE sale_id = ?
  `, draft.id);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE sales SET status = 'COMPLETED', payment_method = ?, total_paise = ?,
       total_cost_paise = ?, completed_at = ?, sync_status = 'PENDING' WHERE id = ?`,
      paymentMethod, draft.totalPaise, cost?.total ?? 0, new Date().toISOString(), draft.id,
    );
    await queueSync(db, 'sale', draft.id, 'CREATE', { paymentMethod, totalPaise: draft.totalPaise });
  });
}

async function queueSync(db: SQLiteDatabase, entityType: string, entityId: string, operationType: string, payload: unknown) {
  await db.runAsync(
    `INSERT INTO sync_outbox (operation_id, entity_type, entity_id, operation_type, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id(), entityType, entityId, operationType, JSON.stringify(payload), new Date().toISOString(),
  );
}
