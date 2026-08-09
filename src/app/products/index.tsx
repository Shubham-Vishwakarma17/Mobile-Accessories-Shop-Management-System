import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { PaginationControls } from '@/components/pagination-controls';
import { Card, PrimaryButton, textStyles } from '@/components/ui';
import { deleteVariant, getVariantsPage } from '@/database/repository';
import { useSync } from '@/providers/sync-provider';
import { colors } from '@/theme/colors';
import type { InventoryVariant, PaginatedResult } from '@/types/domain';
import { formatInr } from '@/utils/currency';

export default function ProductsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { syncNow } = useSync();
  const [result, setResult] = useState<PaginatedResult<InventoryVariant>>({ items: [], page: 1, pageSize: 8, totalItems: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const load = useCallback(() => { getVariantsPage(db, { page, pageSize: 8, search }).then((next) => { setResult(next); if (next.page !== page) setPage(next.page); }); }, [db, page, search]);
  useFocusEffect(load);
  const remove = (item: InventoryVariant) => Alert.alert('Delete this stock item?', `${item.productName} · ${item.variantName} will be removed. Past sales remain safe.`, [{ text: 'Keep item', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteVariant(db, item.id); await syncNow().catch(() => undefined); load(); } catch (error) { Alert.alert('Could not delete item', error instanceof Error ? error.message : 'Please try again.'); } } }]);

  return (
    <View style={styles.page}>
      <FlatList
        data={result.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<View style={styles.intro}><Text style={textStyles.heading}>What is in your shop?</Text><Text style={textStyles.muted}>Search a product, check its pieces, or add newly arrived stock.</Text><TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Search by product, colour or SKU" placeholderTextColor={colors.muted} style={styles.search} returnKeyType="search" /><Pressable onPress={() => router.push('/products/bulk-qr')} style={styles.bulkButton}><Text style={styles.bulkButtonText}>Download many QR labels</Text></Pressable></View>}
        renderItem={({ item }) => <VariantCard item={item} onDetails={() => router.push({ pathname: '/products/details/[id]', params: { id: item.id } })} onUpdate={() => router.push({ pathname: '/products/[id]', params: { id: item.id } })} onQr={() => router.push({ pathname: '/products/qr/[id]', params: { id: item.id } })} onDelete={() => remove(item)} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={textStyles.heading}>{search ? 'No matching product' : 'No products yet'}</Text><Text style={textStyles.muted}>{search ? 'Try a different product name or colour.' : 'Tap “Add a product” to create your first QR code.'}</Text></View>}
        ListFooterComponent={result.totalItems > 0 ? <PaginationControls page={result.page} totalPages={result.totalPages} totalItems={result.totalItems} onPageChange={setPage} /> : null}
      />
      <View style={styles.footer}><PrimaryButton label="Add a product" onPress={() => router.push('/products/new')} /></View>
    </View>
  );
}

function VariantCard({ item, onDetails, onUpdate, onQr, onDelete }: { item: InventoryVariant; onDetails: () => void; onUpdate: () => void; onQr: () => void; onDelete: () => void }) {
  const low = item.stockQuantity <= item.lowStockThreshold;
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={styles.product}>{item.productName}</Text>
          <Text style={styles.variant}>{item.variantName}</Text>
          <Text style={styles.price}>{formatInr(item.sellingPricePaise)}</Text>
        </View>
        <Pressable accessibilityLabel={`Open QR label for ${item.productName} ${item.variantName}`} onPress={onQr} style={styles.qr}>
          <QRCode value={item.qrValue} size={62} color={colors.ink} backgroundColor={colors.white} />
          <Text style={styles.qrHint}>Open</Text>
        </Pressable>
      </View>
      <View style={styles.cardBottom}><View><Text style={[styles.stockNumber, low && styles.stockNumberLow]}>{item.stockQuantity}</Text><Text style={styles.stockCaption}>{low ? 'pieces left — add stock soon' : 'pieces available'}</Text></View></View>
      <Text style={styles.sku}>SKU: {item.sku}</Text>
      <View style={styles.actions}><Pressable onPress={onDetails} style={styles.detailsButton}><Text style={styles.detailsText}>View details</Text></Pressable><Pressable onPress={onUpdate} style={styles.updateButton}><Text style={styles.updateButtonText}>+ Add stock</Text></Pressable><Pressable accessibilityLabel={`Delete ${item.productName} ${item.variantName}`} onPress={onDelete} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable></View>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  list: { padding: 20, paddingBottom: 104, gap: 12 },
  intro: { marginBottom: 8, gap: 8 },
  search: { height: 52, marginTop: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, color: colors.ink, fontSize: 16 },
  bulkButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primarySoft },
  bulkButtonText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  card: { gap: 14 },
  cardTop: { flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  cardCopy: { flex: 1 },
  product: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  variant: { color: colors.muted, fontSize: 14, marginTop: 2 },
  sku: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  price: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 8 },
  qr: { backgroundColor: colors.white, padding: 6, alignSelf: 'center', alignItems: 'center' },
  qrHint: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 4 },
  cardBottom: { paddingTop: 13, borderTopWidth: 1, borderColor: colors.border },
  stockNumber: { color: colors.primary, fontSize: 26, lineHeight: 28, fontWeight: '900' },
  stockNumberLow: { color: colors.danger },
  stockCaption: { color: colors.muted, fontSize: 12, marginTop: 2 },
  updateButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.primarySoft },
  updateButtonText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  detailsButton: { flexGrow: 1, minHeight: 43, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 11, borderRadius: 13, borderWidth: 1, borderColor: colors.primary },
  detailsText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  deleteButton: { minHeight: 43, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.dangerSoft },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: colors.background },
});
