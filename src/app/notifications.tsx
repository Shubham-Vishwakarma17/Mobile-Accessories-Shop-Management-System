import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { PaginationControls } from '@/components/pagination-controls';
import { Card, textStyles } from '@/components/ui';
import { getVariantsPage } from '@/database/repository';
import { colors } from '@/theme/colors';
import type { InventoryVariant, PaginatedResult } from '@/types/domain';

export default function NotificationsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResult<InventoryVariant>>({ items: [], page: 1, pageSize: 8, totalItems: 0, totalPages: 1 });
  const load = useCallback(() => { getVariantsPage(db, { page, pageSize: 8, lowStockOnly: true }).then((next) => { setResult(next); if (next.page !== page) setPage(next.page); }); }, [db, page]);
  useFocusEffect(load);

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.list}
      data={result.items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={<View style={styles.header}><Text style={textStyles.heading}>Products needing attention</Text><Text style={textStyles.muted}>These products have reached their low-stock limit. Add stock when a delivery arrives.</Text></View>}
      ListEmptyComponent={<Card style={styles.empty}><Text style={styles.allGood}>✓</Text><Text style={textStyles.heading}>Everything looks good</Text><Text style={textStyles.muted}>No product is running low right now.</Text></Card>}
      ListFooterComponent={result.totalItems > 0 ? <PaginationControls page={result.page} totalPages={result.totalPages} totalItems={result.totalItems} onPageChange={setPage} /> : null}
      renderItem={({ item }) => (
        <Card style={styles.alertCard}>
          <View style={[styles.alertIcon, item.stockQuantity === 0 && styles.outIcon]}><Text style={styles.alertIconText}>{item.stockQuantity === 0 ? '0' : '!'}</Text></View>
          <View style={styles.copy}><Text style={styles.product}>{item.productName}</Text><Text style={textStyles.muted}>{item.variantName}</Text><Text style={[styles.message, item.stockQuantity === 0 && styles.outText]}>{item.stockQuantity === 0 ? 'Out of stock' : `Only ${item.stockQuantity} pieces left`}</Text></View>
          <Pressable onPress={() => router.push({ pathname: '/products/[id]', params: { id: item.id } })} style={styles.action}><Text style={styles.actionText}>Add stock</Text></Pressable>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  list: { padding: 20, paddingBottom: 32, gap: 12 },
  header: { gap: 5, marginBottom: 8 },
  empty: { alignItems: 'center', gap: 7, paddingVertical: 32 },
  allGood: { color: colors.white, backgroundColor: colors.primary, width: 48, height: 48, borderRadius: 24, textAlign: 'center', textAlignVertical: 'center', fontSize: 25, fontWeight: '900', marginBottom: 5 },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#FFF1D6', alignItems: 'center', justifyContent: 'center' },
  outIcon: { backgroundColor: colors.dangerSoft },
  alertIconText: { color: colors.danger, fontWeight: '900', fontSize: 18 },
  copy: { flex: 1 },
  product: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  message: { color: '#A45B08', fontSize: 13, fontWeight: '800', marginTop: 5 },
  outText: { color: colors.danger },
  action: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.primarySoft },
  actionText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
});
