import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PrimaryButton, textStyles } from '@/components/ui';
import { getDashboardSummary } from '@/database/repository';
import { useSync } from '@/providers/sync-provider';
import { colors } from '@/theme/colors';
import type { DashboardSummary } from '@/types/domain';
import { formatInr } from '@/utils/currency';

const empty: DashboardSummary = { todayRevenuePaise: 0, todaySales: 0, totalVariants: 0, lowStock: 0, outOfStock: 0, draftItems: 0 };

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { status, lastSyncedAt, error: syncError, syncNow } = useSync();
  const [summary, setSummary] = useState(empty);

  const refresh = useCallback(() => { getDashboardSummary(db).then(setSummary); }, [db]);
  useFocusEffect(refresh);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
            <Text style={textStyles.eyebrow}>Today at your shop</Text>
            <Text style={textStyles.title}>What would you like to do?</Text>
            </View>
            <Pressable accessibilityLabel="Open stock alerts" onPress={() => router.push('/notifications')} style={styles.bell}>
              <Text style={styles.bellIcon}>!</Text>
              {summary.lowStock + summary.outOfStock > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{summary.lowStock + summary.outOfStock}</Text></View> : null}
            </Pressable>
          </View>
          <Pressable onPress={() => syncNow().then(refresh).catch(() => undefined)} style={styles.syncPill}>
            <View style={[styles.onlineDot, status === 'error' || status === 'offline' ? styles.offlineDot : undefined]} />
            <Text style={styles.syncText}>{syncLabel(status, lastSyncedAt)}</Text>
          </Pressable>
          {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
        </View>

        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>TODAY’S REVENUE</Text>
          <Text style={styles.revenue}>{formatInr(summary.todayRevenuePaise)}</Text>
          <Text style={styles.revenueMeta}>{summary.todaySales} completed {summary.todaySales === 1 ? 'sale' : 'sales'}</Text>
        </View>

        <View style={styles.grid}>
          <Metric label="Products to manage" value={summary.totalVariants} />
          <Metric label="Running low" value={summary.lowStock} warning={summary.lowStock > 0} />
          <Metric label="Finished stock" value={summary.outOfStock} danger={summary.outOfStock > 0} />
          <Metric label="Items being sold" value={summary.draftItems} />
        </View>

        <PrimaryButton label="Scan a product to sell" onPress={() => router.push('/scan')} />

        <View style={styles.actions}>
          <Action label="Check or add stock" detail="See every product and update quantities" onPress={() => router.push('/products')} />
          <Action label="Finish current sale" detail="Choose Cash, UPI, Card or Credit" onPress={() => router.push('/sale')} />
          <Action label="Customer repairs" detail="Record a customer’s phone left for repair" onPress={() => router.push('/repairs')} />
          <Action label="Backup and account" detail="Synchronize data or sign out safely" onPress={() => router.push('/more')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function syncLabel(status: string, lastSyncedAt: string | null) {
  if (status === 'syncing') return 'Synchronizing…';
  if (status === 'offline') return 'Offline · tap to retry';
  if (status === 'error') return 'Sync issue · tap to retry';
  if (!lastSyncedAt) return 'Ready to synchronize';
  return `Synced ${new Date(lastSyncedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}

function Metric({ label, value, warning, danger }: { label: string; value: number; warning?: boolean; danger?: boolean }) {
  return <Card style={[styles.metric, danger ? styles.dangerCard : warning ? styles.warningCard : undefined]}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Card>;
}

function Action({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}><View><Text style={styles.actionTitle}>{label}</Text><Text style={textStyles.muted}>{detail}</Text></View><Text style={styles.arrow}>›</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 32, gap: 18 },
  header: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  titleCopy: { flex: 1 },
  bell: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  bellIcon: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  badge: { position: 'absolute', right: -4, top: -5, minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  syncPill: { alignSelf: 'flex-start', flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.primarySoft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  offlineDot: { backgroundColor: colors.danger },
  syncText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  syncError: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  revenueCard: { backgroundColor: colors.primary, borderRadius: 24, padding: 22, gap: 6 },
  revenueLabel: { color: '#CBE4D3', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  revenue: { color: colors.white, fontSize: 38, fontWeight: '900' },
  revenueMeta: { color: '#CBE4D3', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', minHeight: 92, justifyContent: 'center' },
  warningCard: { backgroundColor: '#FFF4E5', borderColor: '#F7D59A' },
  dangerCard: { backgroundColor: colors.dangerSoft, borderColor: '#FECDCA' },
  metricValue: { color: colors.ink, fontSize: 28, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontSize: 13, marginTop: 3 },
  actions: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  action: { minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  actionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  arrow: { color: colors.primary, fontSize: 30 },
});
