import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PaginationControls } from '@/components/pagination-controls';
import { Card, PrimaryButton, textStyles } from '@/components/ui';
import { getRepairJobsPage } from '@/database/repository';
import { colors } from '@/theme/colors';
import type { PaginatedResult, RepairJob } from '@/types/domain';
import { formatInr } from '@/utils/currency';

const statusLabel = { RECEIVED: 'Received', IN_REPAIR: 'Repairing', READY: 'Ready', DELIVERED: 'Delivered' } as const;

export default function RepairsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<PaginatedResult<RepairJob>>({ items: [], page: 1, pageSize: 8, totalItems: 0, totalPages: 1 });
  const load = useCallback(() => { getRepairJobsPage(db, { page, pageSize: 8, search }).then((next) => { setResult(next); if (next.page !== page) setPage(next.page); }); }, [db, page, search]);
  useFocusEffect(load);

  return <View style={styles.page}><FlatList data={result.items} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}
    ListHeaderComponent={<View style={styles.header}><Text style={textStyles.heading}>Customer repairs</Text><Text style={textStyles.muted}>Keep the customer’s phone and repair details safely in one place.</Text><TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Search name, phone, device or problem" placeholderTextColor={colors.muted} style={styles.search} /></View>}
    ListEmptyComponent={<Card style={styles.empty}><Text style={textStyles.heading}>{search ? 'No matching repair' : 'No repair jobs yet'}</Text><Text style={textStyles.muted}>{search ? 'Try a different name or phone number.' : 'Tap “Add customer repair” when someone leaves a device.'}</Text></Card>}
    renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: '/repairs/[id]', params: { id: item.id } })}><Card style={styles.card}><View style={styles.row}><View style={styles.copy}><Text style={styles.customer}>{item.customerName}</Text><Text style={styles.phone}>{item.phone}</Text></View><View style={[styles.badge, item.status === 'READY' && styles.ready]}><Text style={styles.badgeText}>{statusLabel[item.status]}</Text></View></View><Text style={styles.device}>{item.deviceName}</Text><Text style={textStyles.muted} numberOfLines={2}>{item.issue}</Text><View style={styles.meta}><Text style={styles.cost}>Estimate {formatInr(item.estimatedCostPaise)}</Text><Text style={styles.arrow}>›</Text></View></Card></Pressable>}
    ListFooterComponent={result.totalItems ? <PaginationControls page={result.page} totalPages={result.totalPages} totalItems={result.totalItems} onPageChange={setPage} /> : null} />
    <View style={styles.footer}><PrimaryButton label="Add customer repair" onPress={() => router.push('/repairs/new')} /></View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, list: { padding: 20, paddingBottom: 105, gap: 11 }, header: { gap: 7, marginBottom: 5 },
  search: { height: 50, marginTop: 5, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, color: colors.ink, fontSize: 16 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 32 }, card: { gap: 8 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, copy: { flex: 1 },
  customer: { color: colors.ink, fontSize: 17, fontWeight: '900' }, phone: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 2 },
  badge: { backgroundColor: '#FFF1D6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }, ready: { backgroundColor: colors.primarySoft }, badgeText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  device: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 3 }, meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: colors.border, paddingTop: 9 }, cost: { color: colors.muted, fontSize: 12, fontWeight: '700' }, arrow: { color: colors.primary, fontSize: 25 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: colors.background },
});
