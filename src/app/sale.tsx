import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { PaginationControls } from '@/components/pagination-controls';
import { Card, PrimaryButton, textStyles } from '@/components/ui';
import { cancelDraftSale, completeDraftSale, getDraftSale } from '@/database/repository';
import { useSync } from '@/providers/sync-provider';
import { colors } from '@/theme/colors';
import type { DraftSale, PaymentMethod } from '@/types/domain';
import { formatInr } from '@/utils/currency';

const methods: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'CASH', label: 'Cash', icon: '₹' },
  { value: 'UPI', label: 'UPI', icon: 'U' },
  { value: 'CARD', label: 'Card', icon: '▭' },
  { value: 'CREDIT', label: 'Credit', icon: 'C' },
  { value: 'OTHER', label: 'Other', icon: '•' },
];

export default function SaleScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { syncNow } = useSync();
  const [sale, setSale] = useState<DraftSale | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const load = useCallback(() => { getDraftSale(db).then((next) => { setSale(next); setPage((current) => Math.min(current, Math.max(1, Math.ceil((next?.items.length ?? 0) / 6)))); }); }, [db]);
  useFocusEffect(load);
  const totalPages = Math.max(1, Math.ceil((sale?.items.length ?? 0) / 6));
  const visibleItems = useMemo(() => sale?.items.slice((page - 1) * 6, page * 6) ?? [], [page, sale]);

  const complete = async () => {
    try {
      setSaving(true);
      await completeDraftSale(db, method);
      await syncNow().catch(() => undefined);
      Alert.alert('Sale recorded', `${formatInr(sale?.totalPaise ?? 0)} received by ${method}.`, [{ text: 'Done', onPress: () => router.replace('/') }]);
    } catch (error) {
      Alert.alert('Could not complete sale', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  const cancel = () => Alert.alert(
    'Cancel this sale?',
    'Every piece in this unpaid sale will be returned to stock.',
    [{ text: 'Keep sale', style: 'cancel' }, { text: 'Cancel sale', style: 'destructive', onPress: async () => {
      try {
        setSaving(true);
        await cancelDraftSale(db);
        await syncNow().catch(() => undefined);
        setSale(null);
        setPage(1);
        Alert.alert('Sale cancelled', 'All reserved pieces were returned to stock.');
      } catch (error) {
        Alert.alert('Could not cancel sale', error instanceof Error ? error.message : 'Please try again.');
      } finally { setSaving(false); }
    } }],
  );

  return (
    <Screen>
      <View><Text style={textStyles.eyebrow}>Checkout</Text><Text style={textStyles.heading}>{sale?.itemCount ? 'Check items and take payment' : 'No sale in progress'}</Text><Text style={textStyles.muted}>{sale?.itemCount ?? 0} pieces in this sale</Text></View>
      {!sale?.items.length ? <Card><Text style={textStyles.body}>No items scanned yet.</Text><Text style={textStyles.muted}>Open the camera and scan a product QR to begin.</Text></Card> : visibleItems.map((item) => (
        <Card key={item.id} style={styles.line}><View style={styles.lineCopy}><Text style={styles.product}>{item.productName}</Text><Text style={textStyles.muted}>{item.variantName} · Qty {item.quantity}</Text></View><Text style={styles.amount}>{formatInr(item.lineTotalPaise)}</Text></Card>
      ))}
      {(sale?.items.length ?? 0) > 0 ? <PaginationControls page={page} totalPages={totalPages} totalItems={sale?.items.length ?? 0} onPageChange={setPage} /> : null}
      <View style={styles.total}><Text style={textStyles.heading}>Total</Text><Text style={styles.totalAmount}>{formatInr(sale?.totalPaise ?? 0)}</Text></View>
      <Text style={styles.sectionLabel}>HOW DID THE CUSTOMER PAY?</Text>
      <View style={styles.methods}>{methods.map((item) => <Pressable key={item.value} onPress={() => setMethod(item.value)} style={[styles.method, method === item.value && styles.methodActive]}><Text style={[styles.methodIcon, method === item.value && styles.methodTextActive]}>{item.icon}</Text><Text style={[styles.methodText, method === item.value && styles.methodTextActive]}>{item.label}</Text></Pressable>)}</View>
      <PrimaryButton label={saving ? 'Recording sale…' : 'Record payment and complete sale'} onPress={complete} disabled={saving || !sale?.itemCount} />
      <Pressable onPress={() => router.push('/scan')}><Text style={styles.scanMore}>Scan more items</Text></Pressable>
      {sale?.itemCount ? <Pressable disabled={saving} onPress={cancel}><Text style={styles.cancel}>Cancel sale and return stock</Text></Pressable> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineCopy: { flex: 1 },
  product: { color: colors.ink, fontWeight: '800', fontSize: 16, marginBottom: 3 },
  amount: { color: colors.ink, fontWeight: '900', fontSize: 17 },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: colors.border, paddingTop: 18 },
  totalAmount: { color: colors.primary, fontSize: 28, fontWeight: '900' },
  sectionLabel: { color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  method: { minWidth: '30%', flexGrow: 1, alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  methodActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  methodText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  methodIcon: { color: colors.muted, fontWeight: '900', fontSize: 18 },
  methodTextActive: { color: colors.primary },
  scanMore: { color: colors.primary, fontSize: 15, fontWeight: '800', textAlign: 'center', padding: 8 },
  cancel: { color: colors.danger, fontSize: 14, fontWeight: '800', textAlign: 'center', padding: 8 },
});
