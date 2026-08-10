import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, PrimaryButton, textStyles } from '@/components/ui';
import { deleteVariant, getVariantById } from '@/database/repository';
import { useSync } from '@/providers/sync-provider';
import { colors } from '@/theme/colors';
import type { InventoryVariant } from '@/types/domain';
import { formatInr } from '@/utils/currency';

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const db = useSQLiteContext(); const router = useRouter(); const { syncNow } = useSync();
  const [item, setItem] = useState<InventoryVariant | null>(null); const [deleting, setDeleting] = useState(false);
  useEffect(() => { if (id) getVariantById(db, id).then(setItem); }, [db, id]);
  const remove = () => Alert.alert('Delete this stock item?', 'It will disappear from stock and its QR will stop working. Past sales remain safe.', [{ text: 'Keep item', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { setDeleting(true); await deleteVariant(db, id); await syncNow().catch(() => undefined); router.replace('/products'); } catch (error) { Alert.alert('Could not delete item', error instanceof Error ? error.message : 'Please try again.'); } finally { setDeleting(false); } } }]);
  if (!item) return <Screen><Text style={textStyles.heading}>Loading product…</Text></Screen>;
  return <Screen><View><Text style={textStyles.eyebrow}>Saved product</Text><Text style={textStyles.heading}>{item.productName}</Text><Text style={textStyles.muted}>{item.variantName}</Text></View>
    <Card style={styles.card}><Detail label="Category" value={item.productCategory} /><Detail label="Brand" value={item.productBrand || 'Not added'} /><Detail label="SKU" value={item.sku} /><Detail label="QR value" value={item.qrValue} /></Card>
    <Card style={styles.card}><View style={styles.two}><Detail label="Purchase price" value={formatInr(item.purchasePricePaise)} /><Detail label="Selling price" value={formatInr(item.sellingPricePaise)} /></View><View style={styles.two}><Detail label="Current stock" value={`${item.stockQuantity} pieces`} /><Detail label="Low-stock alert" value={`${item.lowStockThreshold} pieces`} /></View></Card>
    <PrimaryButton label="Add new stock" onPress={() => router.push({ pathname: '/products/[id]', params: { id } })} />
    <Pressable onPress={() => router.push({ pathname: '/products/qr/[id]', params: { id } })} style={styles.qr}><Text style={styles.qrText}>Open QR label</Text></Pressable>
    <Pressable disabled={deleting} onPress={remove} style={styles.delete}><Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete this stock item'}</Text></Pressable>
  </Screen>;
}

function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detail}><Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{value}</Text></View>; }
const styles = StyleSheet.create({ card: { gap: 16 }, two: { flexDirection: 'row', gap: 16 }, detail: { flex: 1, gap: 4 }, label: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .6 }, value: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: '800' }, qr: { minHeight: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: 15 }, qrText: { color: colors.primary, fontSize: 15, fontWeight: '900' }, delete: { minHeight: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dangerSoft, borderRadius: 15 }, deleteText: { color: colors.danger, fontSize: 14, fontWeight: '900' } });
