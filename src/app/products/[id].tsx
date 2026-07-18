import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Field, PrimaryButton, textStyles } from '@/components/ui';
import { addStock, getVariantById } from '@/database/repository';
import { useSync } from '@/providers/sync-provider';
import { colors } from '@/theme/colors';
import type { InventoryVariant } from '@/types/domain';

export default function AddStockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { syncNow } = useSync();
  const [variant, setVariant] = useState<InventoryVariant | null>(null);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (id) getVariantById(db, id).then(setVariant); }, [db, id]);

  const save = async () => {
    try {
      setSaving(true);
      const newTotal = await addStock(db, id, Number(quantity), note);
      await syncNow().catch(() => undefined);
      Alert.alert('Stock updated', `You now have ${newTotal} pieces of this variant.`, [{ text: 'Done', onPress: () => router.back() }]);
    } catch (error) {
      Alert.alert('Could not update stock', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <Screen>
      <View><Text style={textStyles.eyebrow}>New stock arrived</Text><Text style={textStyles.heading}>{variant?.productName ?? 'Loading product…'}</Text><Text style={textStyles.muted}>{variant?.variantName}</Text></View>
      <Card style={styles.current}><Text style={styles.currentNumber}>{variant?.stockQuantity ?? '—'}</Text><Text style={textStyles.muted}>pieces currently in the shop</Text></Card>
      <Field label="How many new pieces arrived?" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="For example: 10" autoFocus returnKeyType="next" />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="For example: Monday delivery" returnKeyType="done" onSubmitEditing={save} />
      <View style={styles.preview}><Text style={textStyles.muted}>New total after saving</Text><Text style={styles.previewNumber}>{variant && Number(quantity) > 0 ? variant.stockQuantity + Number(quantity) : variant?.stockQuantity ?? 0} pieces</Text></View>
      <PrimaryButton label={saving ? 'Updating…' : 'Add these pieces'} onPress={save} disabled={saving || !variant} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  current: { alignItems: 'center', gap: 3, paddingVertical: 24 },
  currentNumber: { color: colors.primary, fontSize: 44, fontWeight: '900' },
  preview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primarySoft, borderRadius: 16, padding: 16 },
  previewNumber: { color: colors.primary, fontSize: 18, fontWeight: '900' },
});
