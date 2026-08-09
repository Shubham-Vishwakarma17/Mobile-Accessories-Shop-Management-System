import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, textStyles } from '@/components/ui';
import { deleteRepairJob, getRepairJobById, updateRepairStatus } from '@/database/repository';
import { useSync } from '@/providers/sync-provider';
import { colors } from '@/theme/colors';
import type { RepairJob, RepairStatus } from '@/types/domain';
import { formatInr } from '@/utils/currency';

const statuses: { value: RepairStatus; label: string }[] = [{ value: 'RECEIVED', label: 'Received' }, { value: 'IN_REPAIR', label: 'Repairing' }, { value: 'READY', label: 'Ready' }, { value: 'DELIVERED', label: 'Delivered' }];

export default function RepairDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const db = useSQLiteContext(); const router = useRouter(); const { syncNow } = useSync();
  const [job, setJob] = useState<RepairJob | null>(null); const [saving, setSaving] = useState(false);
  useEffect(() => { if (id) getRepairJobById(db, id).then(setJob); }, [db, id]);
  const setStatus = async (status: RepairStatus) => { try { setSaving(true); await updateRepairStatus(db, id, status); setJob((current) => current ? { ...current, status } : current); await syncNow().catch(() => undefined); } catch (error) { Alert.alert('Could not update repair', error instanceof Error ? error.message : 'Please try again.'); } finally { setSaving(false); } };
  const remove = () => Alert.alert('Delete this repair record?', 'The record will disappear from the app. This cannot be undone from the screen.', [{ text: 'Keep record', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { setSaving(true); await deleteRepairJob(db, id); await syncNow().catch(() => undefined); router.replace('/repairs'); } catch (error) { Alert.alert('Could not delete record', error instanceof Error ? error.message : 'Please try again.'); } finally { setSaving(false); } } }]);
  if (!job) return <Screen><Text style={textStyles.heading}>Loading repair…</Text></Screen>;
  return <Screen><View><Text style={textStyles.eyebrow}>Customer repair</Text><Text style={textStyles.heading}>{job.customerName}</Text><Pressable onPress={() => Linking.openURL(`tel:${job.phone}`)}><Text style={styles.phone}>{job.phone} · Tap to call</Text></Pressable>{job.alternatePhone ? <Text style={textStyles.muted}>Alternate: {job.alternatePhone}</Text> : null}</View>
    <Card style={styles.card}><Label title="Device" value={job.deviceName} /><Label title="Problem" value={job.issue} />{job.accessoriesReceived ? <Label title="Items left at shop" value={job.accessoriesReceived} /> : null}{job.conditionNotes ? <Label title="Existing condition" value={job.conditionNotes} /> : null}</Card>
    <Card style={styles.card}><View style={styles.amountRow}><Label title="Estimated cost" value={formatInr(job.estimatedCostPaise)} /><Label title="Advance received" value={formatInr(job.advancePaise)} /></View>{job.promisedDate ? <Label title="Expected delivery" value={job.promisedDate} /> : null}{job.notes ? <Label title="Other note" value={job.notes} /> : null}<Label title="Received" value={new Date(job.receivedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} /></Card>
    <Text style={textStyles.eyebrow}>Update repair status</Text><View style={styles.statuses}>{statuses.map((item) => <Pressable disabled={saving} key={item.value} onPress={() => setStatus(item.value)} style={[styles.status, job.status === item.value && styles.statusActive]}><Text style={[styles.statusText, job.status === item.value && styles.statusTextActive]}>{item.label}</Text></Pressable>)}</View>
    <Pressable disabled={saving} onPress={remove} style={styles.delete}><Text style={styles.deleteText}>Delete repair record</Text></Pressable>
  </Screen>;
}

function Label({ title, value }: { title: string; value: string }) { return <View style={styles.label}><Text style={styles.labelTitle}>{title}</Text><Text style={styles.labelValue}>{value}</Text></View>; }
const styles = StyleSheet.create({ phone: { color: colors.primary, fontSize: 15, fontWeight: '900', marginTop: 6 }, card: { gap: 14 }, label: { flex: 1, gap: 3 }, labelTitle: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .6 }, labelValue: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: '700' }, amountRow: { flexDirection: 'row', gap: 16 }, statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, status: { minWidth: '45%', flexGrow: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, statusActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, statusText: { color: colors.muted, fontWeight: '800' }, statusTextActive: { color: colors.primary }, delete: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.dangerSoft }, deleteText: { color: colors.danger, fontSize: 15, fontWeight: '900' } });
