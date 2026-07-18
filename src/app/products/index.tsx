import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Card, PrimaryButton, textStyles } from '@/components/ui';
import { listVariants } from '@/database/repository';
import { colors } from '@/theme/colors';
import type { InventoryVariant } from '@/types/domain';
import { formatInr } from '@/utils/currency';

export default function ProductsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [variants, setVariants] = useState<InventoryVariant[]>([]);
  const [search, setSearch] = useState('');
  const load = useCallback(() => { listVariants(db).then(setVariants); }, [db]);
  useFocusEffect(load);

  return (
    <View style={styles.page}>
      <FlatList
        data={variants.filter((item) => `${item.productName} ${item.variantName} ${item.sku}`.toLowerCase().includes(search.trim().toLowerCase()))}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<View style={styles.intro}><Text style={textStyles.heading}>What is in your shop?</Text><Text style={textStyles.muted}>Search a product, check its pieces, or add newly arrived stock.</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search by product, colour or SKU" placeholderTextColor={colors.muted} style={styles.search} returnKeyType="search" /></View>}
        renderItem={({ item }) => <VariantCard item={item} onUpdate={() => router.push({ pathname: '/products/[id]', params: { id: item.id } })} onQr={() => router.push({ pathname: '/products/qr/[id]', params: { id: item.id } })} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={textStyles.heading}>{search ? 'No matching product' : 'No products yet'}</Text><Text style={textStyles.muted}>{search ? 'Try a different product name or colour.' : 'Tap “Add a product” to create your first QR code.'}</Text></View>}
      />
      <View style={styles.footer}><PrimaryButton label="Add a product" onPress={() => router.push('/products/new')} /></View>
    </View>
  );
}

function VariantCard({ item, onUpdate, onQr }: { item: InventoryVariant; onUpdate: () => void; onQr: () => void }) {
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
      <View style={styles.cardBottom}>
        <View><Text style={[styles.stockNumber, low && styles.stockNumberLow]}>{item.stockQuantity}</Text><Text style={styles.stockCaption}>{low ? 'pieces left — add stock soon' : 'pieces available'}</Text></View>
        <Pressable onPress={onUpdate} style={styles.updateButton}><Text style={styles.updateButtonText}>+ Add stock</Text></Pressable>
      </View>
      <Text style={styles.sku}>SKU: {item.sku}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  list: { padding: 20, paddingBottom: 104, gap: 12 },
  intro: { marginBottom: 8, gap: 8 },
  search: { height: 52, marginTop: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, color: colors.ink, fontSize: 16 },
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
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 13, borderTopWidth: 1, borderColor: colors.border },
  stockNumber: { color: colors.primary, fontSize: 26, lineHeight: 28, fontWeight: '900' },
  stockNumberLow: { color: colors.danger },
  stockCaption: { color: colors.muted, fontSize: 12, marginTop: 2 },
  updateButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.primarySoft },
  updateButtonText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: colors.background },
});
