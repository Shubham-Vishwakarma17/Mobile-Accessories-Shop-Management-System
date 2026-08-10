import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, PrimaryButton, textStyles } from '@/components/ui';
import { addVariantQuantityToDraft, getVariantById } from '@/database/repository';
import { colors } from '@/theme/colors';
import type { InventoryVariant } from '@/types/domain';
import { formatInr } from '@/utils/currency';

export default function ConfirmScannedProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const [variant, setVariant] = useState<InventoryVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (id) getVariantById(db, id).then(setVariant); }, [db, id]);

  const changeQuantity = (next: number) => {
    if (!variant) return;
    setQuantity(Math.max(1, Math.min(next, variant.stockQuantity)));
  };

  const continueToPayment = async () => {
    try {
      setSaving(true);
      await addVariantQuantityToDraft(db, id, quantity);
      router.replace('/sale');
    } catch (error) {
      Alert.alert('Could not add product', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  if (!variant) return <Screen><Text style={textStyles.muted}>Finding the scanned product…</Text></Screen>;

  return (
    <Screen>
      <View style={styles.found}><Text style={styles.check}>✓</Text><View><Text style={styles.foundLabel}>PRODUCT FOUND</Text><Text style={textStyles.muted}>Check it before continuing</Text></View></View>
      <Card style={styles.productCard}>
        <View style={styles.productMark}><Text style={styles.productMarkText}>{variant.productName.slice(0, 2).toUpperCase()}</Text></View>
        <Text style={styles.productName}>{variant.productName}</Text>
        <Text style={styles.variantName}>{variant.variantName}</Text>
        <Text style={styles.price}>{formatInr(variant.sellingPricePaise)} each</Text>
        <View style={[styles.stock, variant.stockQuantity <= variant.lowStockThreshold && styles.stockLow]}><Text style={[styles.stockText, variant.stockQuantity <= variant.lowStockThreshold && styles.stockTextLow]}>{variant.stockQuantity} pieces available</Text></View>
      </Card>

      <View style={styles.quantitySection}>
        <Text style={textStyles.heading}>How many pieces?</Text>
        <View style={styles.stepper}>
          <Pressable accessibilityLabel="Decrease quantity" onPress={() => changeQuantity(quantity - 1)} style={styles.stepButton}><Text style={styles.stepButtonText}>−</Text></Pressable>
          <View style={styles.quantityBox}><Text style={styles.quantity}>{quantity}</Text><Text style={styles.pieces}>pieces</Text></View>
          <Pressable accessibilityLabel="Increase quantity" onPress={() => changeQuantity(quantity + 1)} style={styles.stepButton}><Text style={styles.stepButtonText}>+</Text></Pressable>
        </View>
        <View style={styles.total}><Text style={textStyles.muted}>Item total</Text><Text style={styles.totalValue}>{formatInr(variant.sellingPricePaise * quantity)}</Text></View>
      </View>

      <PrimaryButton label={saving ? 'Adding…' : 'Continue to payment'} onPress={continueToPayment} disabled={saving || variant.stockQuantity === 0} />
      <Pressable onPress={() => router.replace('/scan')}><Text style={styles.scanAgain}>This is not the right product — scan again</Text></Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  found: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySoft, padding: 14, borderRadius: 16 },
  check: { width: 34, height: 34, textAlign: 'center', textAlignVertical: 'center', borderRadius: 17, backgroundColor: colors.primary, color: colors.white, fontSize: 20, fontWeight: '900' },
  foundLabel: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  productCard: { alignItems: 'center', gap: 5, paddingVertical: 24 },
  productMark: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9E1FF', marginBottom: 5 },
  productMarkText: { color: '#6A45B8', fontSize: 21, fontWeight: '900' },
  productName: { color: colors.ink, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  variantName: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  price: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 6 },
  stock: { marginTop: 7, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.primarySoft },
  stockLow: { backgroundColor: colors.dangerSoft },
  stockText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  stockTextLow: { color: colors.danger },
  quantitySection: { gap: 15 },
  stepper: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18 },
  stepButton: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stepButtonText: { color: colors.primary, fontSize: 34, lineHeight: 36, fontWeight: '700' },
  quantityBox: { minWidth: 92, alignItems: 'center' },
  quantity: { color: colors.ink, fontSize: 42, lineHeight: 46, fontWeight: '900' },
  pieces: { color: colors.muted, fontSize: 12 },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
  totalValue: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  scanAgain: { color: colors.muted, textAlign: 'center', padding: 8, fontWeight: '700' },
});
