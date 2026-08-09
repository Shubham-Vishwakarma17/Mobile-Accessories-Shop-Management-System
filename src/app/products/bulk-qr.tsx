import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PaginationControls } from '@/components/pagination-controls';
import { Card, PrimaryButton, textStyles } from '@/components/ui';
import { getVariantsPage } from '@/database/repository';
import { createAndShareQrLabels } from '@/services/qr-pdf';
import { colors } from '@/theme/colors';
import type { InventoryVariant, PaginatedResult } from '@/types/domain';

type SelectedItem = { variant: InventoryVariant; quantity: number };

export default function BulkQrScreen() {
  const db = useSQLiteContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<PaginatedResult<InventoryVariant>>({ items: [], page: 1, pageSize: 8, totalItems: 0, totalPages: 1 });
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => { getVariantsPage(db, { page, pageSize: 8, search }).then((next) => { setResult(next); if (next.page !== page) setPage(next.page); }); }, [db, page, search]);
  useFocusEffect(load);

  const labelCount = useMemo(() => Object.values(selected).reduce((sum, item) => sum + item.quantity, 0), [selected]);
  const selectedCount = Object.keys(selected).length;
  const allPageSelected = result.items.length > 0 && result.items.every((item) => selected[item.id]);

  const toggle = (variant: InventoryVariant) => setSelected((current) => {
    const next = { ...current };
    if (next[variant.id]) delete next[variant.id];
    else next[variant.id] = { variant, quantity: 1 };
    return next;
  });
  const changeQuantity = (variant: InventoryVariant, change: number) => setSelected((current) => {
    const existing = current[variant.id];
    if (!existing) return current;
    return { ...current, [variant.id]: { ...existing, quantity: Math.max(1, Math.min(50, existing.quantity + change)) } };
  });
  const togglePage = () => setSelected((current) => {
    const next = { ...current };
    result.items.forEach((variant) => {
      if (allPageSelected) delete next[variant.id];
      else if (!next[variant.id]) next[variant.id] = { variant, quantity: 1 };
    });
    return next;
  });
  const createPdf = async () => {
    try {
      setCreating(true);
      const output = await createAndShareQrLabels(Object.values(selected));
      Alert.alert(
        output.delivery === 'shared' ? 'QR label PDF ready' : 'Choose Save as PDF',
        output.delivery === 'shared'
          ? `${output.labelCount} labels were arranged on ${output.pageCount} A4 ${output.pageCount === 1 ? 'page' : 'pages'}.`
          : `In the print screen, select “Save as PDF” to download ${output.labelCount} labels.`,
      );
    } catch (error) {
      Alert.alert('Could not create PDF', error instanceof Error ? error.message : 'Please try again.');
    } finally { setCreating(false); }
  };

  return (
    <View style={styles.page}>
      <FlatList
        data={result.items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={<View style={styles.header}><Text style={textStyles.heading}>Choose labels to print</Text><Text style={textStyles.muted}>Select products, choose how many labels you need, then save the A4 PDF.</Text><TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Search product, variant or SKU" placeholderTextColor={colors.muted} style={styles.search} /><Pressable onPress={togglePage} style={styles.pageSelect}><Text style={styles.pageSelectText}>{allPageSelected ? 'Unselect this page' : 'Select this page'}</Text></Pressable></View>}
        renderItem={({ item }) => {
          const selection = selected[item.id];
          return <Card style={[styles.item, selection && styles.itemSelected]}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(selection) }} onPress={() => toggle(item)} style={styles.itemTop}><View style={[styles.checkbox, selection && styles.checkboxSelected]}><Text style={styles.check}>{selection ? '✓' : ''}</Text></View><View style={styles.copy}><Text style={styles.product}>{item.productName}</Text><Text style={textStyles.muted}>{item.variantName}</Text><Text style={styles.sku}>SKU: {item.sku}</Text></View></Pressable>{selection ? <View style={styles.quantity}><Text style={styles.quantityLabel}>Labels for this item</Text><View style={styles.stepper}><Pressable onPress={() => changeQuantity(item, -1)} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.quantityValue}>{selection.quantity}</Text><Pressable onPress={() => changeQuantity(item, 1)} style={styles.step}><Text style={styles.stepText}>+</Text></Pressable></View></View> : null}</Card>;
        }}
        ListEmptyComponent={<Card><Text style={textStyles.heading}>No products found</Text><Text style={textStyles.muted}>Try another search or add a product first.</Text></Card>}
        ListFooterComponent={result.totalItems > 0 ? <PaginationControls page={result.page} totalPages={result.totalPages} totalItems={result.totalItems} onPageChange={setPage} /> : null}
      />
      <View style={styles.footer}><Text style={styles.summary}>{selectedCount} products · {labelCount} labels {labelCount ? `· ${Math.ceil(labelCount / 20)} A4 page${labelCount > 20 ? 's' : ''}` : ''}</Text><PrimaryButton label={creating ? 'Preparing labels…' : `Save or print PDF (${labelCount})`} onPress={createPdf} disabled={creating || labelCount === 0 || labelCount > 200} />{labelCount > 200 ? <Text style={styles.limit}>Maximum 200 labels at one time.</Text> : null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  list: { padding: 20, paddingBottom: 148, gap: 11 },
  header: { gap: 8, marginBottom: 6 },
  search: { height: 50, marginTop: 5, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, color: colors.ink, fontSize: 16 },
  pageSelect: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primarySoft },
  pageSelectText: { color: colors.primary, fontWeight: '900' },
  item: { gap: 14, padding: 15 },
  itemSelected: { borderColor: colors.primary, backgroundColor: '#F4FAF6' },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  check: { color: colors.white, fontSize: 18, fontWeight: '900' },
  copy: { flex: 1 },
  product: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  sku: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  quantity: { paddingTop: 12, borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quantityLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  step: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  quantityValue: { minWidth: 24, textAlign: 'center', color: colors.ink, fontSize: 17, fontWeight: '900' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 8, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.border },
  summary: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  limit: { color: colors.danger, fontSize: 12, textAlign: 'center' },
});
