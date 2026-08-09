import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { DashboardSummary, DraftSale, InventoryVariant, PaginatedResult, PaymentMethod, RepairJob, RepairStatus } from '@/types/domain';

const id = () => Crypto.randomUUID();

export async function getDashboardSummary(db: SQLiteDatabase): Promise<DashboardSummary> {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [stock, sales, draft] = await Promise.all([
    db.getFirstAsync<{ total: number; low: number; out: number }>(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) AS low,
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out
      FROM variants WHERE is_active = 1
    `),
    db.getFirstAsync<{ count: number; revenue: number }>(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total_paise), 0) AS revenue
       FROM sales WHERE status = 'COMPLETED' AND date(completed_at, 'localtime') = ?`, today,
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
    SELECT v.id, v.product_id AS productId, p.name AS productName, p.category AS productCategory, p.brand AS productBrand,
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

export async function getVariantsPage(db: SQLiteDatabase, options: {
  page?: number;
  pageSize?: number;
  search?: string;
  lowStockOnly?: boolean;
} = {}): Promise<PaginatedResult<InventoryVariant>> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));
  const search = `%${options.search?.trim().toLowerCase() ?? ''}%`;
  const lowStockClause = options.lowStockOnly ? 'AND v.stock_quantity <= v.low_stock_threshold' : '';
  const orderBy = options.lowStockOnly
    ? 'v.stock_quantity ASC, p.name COLLATE NOCASE, v.variant_name COLLATE NOCASE'
    : 'p.name COLLATE NOCASE, v.variant_name COLLATE NOCASE';
  const where = `
    WHERE v.is_active = 1 AND p.is_active = 1
      AND (LOWER(p.name) LIKE ? OR LOWER(v.variant_name) LIKE ? OR LOWER(v.sku) LIKE ?)
      ${lowStockClause}
  `;
  const totalRow = await db.getFirstAsync<{ count: number }>(`
    SELECT COUNT(*) AS count FROM variants v JOIN products p ON p.id = v.product_id ${where}
  `, search, search, search);
  const totalItems = totalRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const items = await db.getAllAsync<InventoryVariant>(`
    SELECT v.id, v.product_id AS productId, p.name AS productName, p.category AS productCategory, p.brand AS productBrand,
      v.variant_name AS variantName, v.sku, v.qr_value AS qrValue,
      v.purchase_price_paise AS purchasePricePaise,
      v.selling_price_paise AS sellingPricePaise,
      v.stock_quantity AS stockQuantity,
      v.low_stock_threshold AS lowStockThreshold
    FROM variants v JOIN products p ON p.id = v.product_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `, search, search, search, pageSize, (safePage - 1) * pageSize);
  return { items, page: safePage, pageSize, totalItems, totalPages };
}

export async function getVariantById(db: SQLiteDatabase, variantId: string): Promise<InventoryVariant | null> {
  return db.getFirstAsync<InventoryVariant>(`
    SELECT v.id, v.product_id AS productId, p.name AS productName, p.category AS productCategory, p.brand AS productBrand,
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
    SELECT v.id, v.product_id AS productId, p.name AS productName, p.category AS productCategory, p.brand AS productBrand,
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

export async function deleteVariant(db: SQLiteDatabase, variantId: string) {
  const variant = await getVariantById(db, variantId);
  if (!variant) throw new Error('This product could not be found.');
  const reserved = await db.getFirstAsync<{ count: number }>(`
    SELECT COALESCE(SUM(si.quantity), 0) AS count FROM sale_items si
    JOIN sales s ON s.id = si.sale_id WHERE s.status = 'DRAFT' AND si.variant_id = ?
  `, variantId);
  if ((reserved?.count ?? 0) > 0) throw new Error('This item is in the current sale. Cancel or complete that sale first.');
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE variants SET is_active = 0, updated_at = ?, sync_status = 'PENDING' WHERE id = ?", now, variantId);
    await queueSync(db, 'variant', variantId, 'DELETE', { softDelete: true });
  });
}

type NewRepairInput = Omit<RepairJob, 'id' | 'status' | 'receivedAt'>;

export async function createRepairJob(db: SQLiteDatabase, input: NewRepairInput) {
  const repairId = id();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`
      INSERT INTO repair_jobs (id, customer_name, phone, alternate_phone, device_name, issue,
        accessories_received, condition_notes, estimated_cost_paise, advance_paise, status,
        received_at, promised_date, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, ?)
    `, repairId, input.customerName.trim(), input.phone.trim(), input.alternatePhone?.trim() || null,
      input.deviceName.trim(), input.issue.trim(), input.accessoriesReceived?.trim() || null,
      input.conditionNotes?.trim() || null, input.estimatedCostPaise, input.advancePaise, now,
      input.promisedDate?.trim() || null, input.notes?.trim() || null, now, now);
    await queueSync(db, 'repairJob', repairId, 'CREATE', input);
  });
  return repairId;
}

const repairSelect = `SELECT id, customer_name AS customerName, phone,
  alternate_phone AS alternatePhone, device_name AS deviceName, issue,
  accessories_received AS accessoriesReceived, condition_notes AS conditionNotes,
  estimated_cost_paise AS estimatedCostPaise, advance_paise AS advancePaise,
  status, received_at AS receivedAt, promised_date AS promisedDate, notes FROM repair_jobs`;

export async function getRepairJobsPage(db: SQLiteDatabase, options: { page?: number; pageSize?: number; search?: string } = {}): Promise<PaginatedResult<RepairJob>> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 8));
  const search = `%${options.search?.trim().toLowerCase() ?? ''}%`;
  const where = `WHERE is_deleted = 0 AND (LOWER(customer_name) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(device_name) LIKE ? OR LOWER(issue) LIKE ?)`;
  const count = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM repair_jobs ${where}`, search, search, search, search);
  const totalItems = count?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const items = await db.getAllAsync<RepairJob>(`${repairSelect} ${where} ORDER BY CASE status WHEN 'READY' THEN 0 WHEN 'RECEIVED' THEN 1 WHEN 'IN_REPAIR' THEN 2 ELSE 3 END, received_at DESC LIMIT ? OFFSET ?`, search, search, search, search, pageSize, (safePage - 1) * pageSize);
  return { items, page: safePage, pageSize, totalItems, totalPages };
}

export async function getRepairJobById(db: SQLiteDatabase, repairId: string) {
  return db.getFirstAsync<RepairJob>(`${repairSelect} WHERE id = ? AND is_deleted = 0`, repairId);
}

export async function updateRepairStatus(db: SQLiteDatabase, repairId: string, status: RepairStatus) {
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE repair_jobs SET status = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ? AND is_deleted = 0", status, now, repairId);
    await queueSync(db, 'repairJob', repairId, 'UPDATE_STATUS', { status });
  });
}

export async function deleteRepairJob(db: SQLiteDatabase, repairId: string) {
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE repair_jobs SET is_deleted = 1, updated_at = ?, sync_status = 'PENDING' WHERE id = ?", now, repairId);
    await queueSync(db, 'repairJob', repairId, 'DELETE', { softDelete: true });
  });
}

export async function addScannedVariant(db: SQLiteDatabase, qrValue: string) {
  let message = '';
  await db.withTransactionAsync(async () => {
    const variant = await db.getFirstAsync<InventoryVariant>(`
      SELECT v.id, v.product_id AS productId, p.name AS productName, p.category AS productCategory, p.brand AS productBrand,
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

export async function cancelDraftSale(db: SQLiteDatabase) {
  const draft = await db.getFirstAsync<{ id: string }>("SELECT id FROM sales WHERE status = 'DRAFT' LIMIT 1");
  if (!draft) return;
  const items = await db.getAllAsync<{ variantId: string; quantity: number; stockQuantity: number }>(`
    SELECT si.variant_id AS variantId, si.quantity, v.stock_quantity AS stockQuantity
    FROM sale_items si JOIN variants v ON v.id = si.variant_id WHERE si.sale_id = ?
  `, draft.id);
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      await db.runAsync(
        "UPDATE variants SET stock_quantity = stock_quantity + ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?",
        item.quantity, now, item.variantId,
      );
      await db.runAsync(
        `INSERT INTO inventory_movements
         (id, variant_id, type, quantity_change, stock_before, stock_after, sale_id, reason, created_at)
         VALUES (?, ?, 'SALE_CANCELLED', ?, ?, ?, ?, 'Sale cancelled before payment', ?)`,
        id(), item.variantId, item.quantity, item.stockQuantity, item.stockQuantity + item.quantity, draft.id, now,
      );
    }
    await db.runAsync("UPDATE sales SET status = 'CANCELLED', sync_status = 'PENDING' WHERE id = ?", draft.id);
    await queueSync(db, 'sale', draft.id, 'CANCEL', { restoredItems: items.length });
  });
}

async function queueSync(db: SQLiteDatabase, entityType: string, entityId: string, operationType: string, payload: unknown) {
  await db.runAsync(
    `INSERT INTO sync_outbox (operation_id, entity_type, entity_id, operation_type, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id(), entityType, entityId, operationType, JSON.stringify(payload), new Date().toISOString(),
  );
}
