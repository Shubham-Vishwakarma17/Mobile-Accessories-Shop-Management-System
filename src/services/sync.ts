import type { SQLiteDatabase } from 'expo-sqlite';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';

import { firestore } from '@/services/firebase';

type LocalRow = Record<string, string | number | null>;

export type SyncResult = { uploaded: number; downloaded: number; syncedAt: string };

export async function synchronizeShop(db: SQLiteDatabase, uid: string): Promise<SyncResult> {
  if (!firestore) throw new Error('Firebase is not configured.');
  const shopRef = doc(firestore, 'shops', uid);
  const [shopSnapshot, pending] = await Promise.all([
    getDoc(shopRef),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox WHERE synced_at IS NULL'),
  ]);

  let uploaded = 0;
  if (!shopSnapshot.exists() || (pending?.count ?? 0) > 0) {
    uploaded = await uploadLocalSnapshot(db, uid);
    await db.runAsync("UPDATE sync_outbox SET synced_at = ? WHERE synced_at IS NULL", new Date().toISOString());
  }

  const downloaded = await downloadCloudSnapshot(db, uid);
  const syncedAt = new Date().toISOString();
  await setDoc(shopRef, { ownerUid: uid, lastSyncedAt: serverTimestamp(), schemaVersion: 1 }, { merge: true });
  return { uploaded, downloaded, syncedAt };
}

async function uploadLocalSnapshot(db: SQLiteDatabase, uid: string) {
  const products = await db.getAllAsync<LocalRow>('SELECT * FROM products');
  const variants = await db.getAllAsync<LocalRow>('SELECT * FROM variants');
  const sales = await db.getAllAsync<LocalRow>("SELECT * FROM sales WHERE status = 'COMPLETED'");
  const saleItems = await db.getAllAsync<LocalRow>(`
    SELECT si.* FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.status = 'COMPLETED'
  `);
  const movements = await db.getAllAsync<LocalRow>(`
    SELECT im.* FROM inventory_movements im
    LEFT JOIN sales s ON s.id = im.sale_id
    WHERE im.sale_id IS NULL OR s.status = 'COMPLETED'
  `);
  const documents: { ref: DocumentReference; data: LocalRow }[] = [
    ...products.map((data) => ({ ref: doc(firestore!, 'shops', uid, 'products', String(data.id)), data })),
    ...variants.map((data) => ({ ref: doc(firestore!, 'shops', uid, 'variants', String(data.id)), data })),
    ...sales.map((data) => ({ ref: doc(firestore!, 'shops', uid, 'sales', String(data.id)), data })),
    ...saleItems.map((data) => ({ ref: doc(firestore!, 'shops', uid, 'saleItems', String(data.id)), data })),
    ...movements.map((data) => ({ ref: doc(firestore!, 'shops', uid, 'inventoryMovements', String(data.id)), data })),
  ];
  for (let start = 0; start < documents.length; start += 400) {
    const batch = writeBatch(firestore!);
    documents.slice(start, start + 400).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
  }
  return documents.length;
}

async function downloadCloudSnapshot(db: SQLiteDatabase, uid: string) {
  const names = ['products', 'variants', 'sales', 'saleItems', 'inventoryMovements'] as const;
  const snapshots = await Promise.all(names.map((name) => getDocs(collection(firestore!, 'shops', uid, name))));
  const [products, variants, sales, saleItems, movements] = snapshots.map((snapshot) => snapshot.docs.map((item) => item.data()));

  await db.withTransactionAsync(async () => {
    for (const row of products) await upsertProduct(db, row);
    for (const row of variants) await upsertVariant(db, row);
    for (const row of sales) await upsertSale(db, row);
    for (const row of saleItems) await upsertSaleItem(db, row);
    for (const row of movements) await upsertMovement(db, row);
  });
  return snapshots.reduce((total, snapshot) => total + snapshot.size, 0);
}

async function upsertProduct(db: SQLiteDatabase, row: DocumentData) {
  await db.runAsync(`
    INSERT INTO products (id, name, category, brand, is_active, created_at, updated_at, sync_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'SYNCED')
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, brand=excluded.brand,
      is_active=excluded.is_active, created_at=excluded.created_at, updated_at=excluded.updated_at, sync_status='SYNCED'
  `, row.id, row.name, row.category, row.brand ?? null, row.is_active, row.created_at, row.updated_at);
}

async function upsertVariant(db: SQLiteDatabase, row: DocumentData) {
  await db.runAsync(`
    INSERT INTO variants (id, product_id, variant_name, sku, qr_value, purchase_price_paise, selling_price_paise,
      stock_quantity, low_stock_threshold, is_active, created_at, updated_at, sync_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
    ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, variant_name=excluded.variant_name,
      sku=excluded.sku, qr_value=excluded.qr_value, purchase_price_paise=excluded.purchase_price_paise,
      selling_price_paise=excluded.selling_price_paise, stock_quantity=excluded.stock_quantity,
      low_stock_threshold=excluded.low_stock_threshold, is_active=excluded.is_active,
      updated_at=excluded.updated_at, sync_status='SYNCED'
  `, row.id, row.product_id, row.variant_name, row.sku, row.qr_value, row.purchase_price_paise,
    row.selling_price_paise, row.stock_quantity, row.low_stock_threshold, row.is_active, row.created_at, row.updated_at);
}

async function upsertSale(db: SQLiteDatabase, row: DocumentData) {
  await db.runAsync(`
    INSERT INTO sales (id, status, payment_method, total_paise, total_cost_paise, created_at, completed_at, sync_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'SYNCED')
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, payment_method=excluded.payment_method,
      total_paise=excluded.total_paise, total_cost_paise=excluded.total_cost_paise,
      completed_at=excluded.completed_at, sync_status='SYNCED'
  `, row.id, row.status, row.payment_method, row.total_paise, row.total_cost_paise, row.created_at, row.completed_at);
}

async function upsertSaleItem(db: SQLiteDatabase, row: DocumentData) {
  await db.runAsync(`
    INSERT INTO sale_items (id, sale_id, variant_id, product_name_snapshot, variant_name_snapshot,
      quantity, unit_price_paise, unit_cost_paise)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET quantity=excluded.quantity, unit_price_paise=excluded.unit_price_paise,
      unit_cost_paise=excluded.unit_cost_paise
  `, row.id, row.sale_id, row.variant_id, row.product_name_snapshot, row.variant_name_snapshot,
    row.quantity, row.unit_price_paise, row.unit_cost_paise);
}

async function upsertMovement(db: SQLiteDatabase, row: DocumentData) {
  await db.runAsync(`
    INSERT INTO inventory_movements (id, variant_id, type, quantity_change, stock_before, stock_after,
      sale_id, reason, created_at, sync_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
    ON CONFLICT(id) DO UPDATE SET sync_status='SYNCED'
  `, row.id, row.variant_id, row.type, row.quantity_change, row.stock_before, row.stock_after,
    row.sale_id ?? null, row.reason ?? null, row.created_at);
}
