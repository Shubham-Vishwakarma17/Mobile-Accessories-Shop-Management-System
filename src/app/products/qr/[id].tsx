import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

import { Screen } from '@/components/screen';
import { PrimaryButton, textStyles } from '@/components/ui';
import { getVariantById } from '@/database/repository';
import { colors } from '@/theme/colors';
import type { InventoryVariant } from '@/types/domain';

export default function QrLabelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const labelRef = useRef<View>(null);
  const [variant, setVariant] = useState<InventoryVariant | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (id) getVariantById(db, id).then(setVariant); }, [db, id]);

  const saveLabel = async () => {
    if (!variant || !labelRef.current) return;
    try {
      setSaving(true);
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo access so the QR label can be saved to your phone.');
        return;
      }
      const uri = await captureRef(labelRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('QR label saved', 'The label image is now in your phone gallery. You can print or share it.');
    } catch (error) {
      Alert.alert('Could not save label', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  if (!variant) return <Screen><Text style={textStyles.muted}>Preparing QR label…</Text></Screen>;

  return (
    <Screen style={styles.screen}>
      <View style={styles.heading}><Text style={textStyles.heading}>Small product label</Text><Text style={textStyles.muted}>Save this image, print it at a small size, and stick it on the correct product type.</Text></View>
      <View style={styles.previewArea}>
        <View ref={labelRef} collapsable={false} style={styles.label}>
          <View style={styles.brandRow}><View style={styles.brandDot} /><Text style={styles.brand}>MY SHOP</Text></View>
          <QRCode value={variant.qrValue} size={152} color="#111C15" backgroundColor="#FFFFFF" quietZone={4} />
          <Text numberOfLines={2} style={styles.product}>{variant.productName}</Text>
          <Text numberOfLines={2} style={styles.variant}>{variant.variantName}</Text>
          <Text style={styles.sku}>{variant.sku}</Text>
        </View>
      </View>
      <View style={styles.sizeHint}><Text style={styles.sizeIcon}>↙</Text><Text style={styles.sizeText}>The saved image includes only the white label above—not the rest of this screen.</Text></View>
      <PrimaryButton label={saving ? 'Saving label…' : 'Save QR label to phone'} onPress={saveLabel} disabled={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'stretch' },
  heading: { gap: 5 },
  previewArea: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8ECE8', borderRadius: 24, paddingVertical: 28 },
  label: { width: 220, minHeight: 270, backgroundColor: '#FFFFFF', borderRadius: 6, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D7DDD8' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
  brandDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  brand: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  product: { color: '#111C15', fontSize: 13, lineHeight: 16, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  variant: { color: '#4E5A52', fontSize: 11, lineHeight: 14, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  sku: { color: '#778078', fontSize: 8, fontWeight: '700', marginTop: 5 },
  sizeHint: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderRadius: 16, padding: 14 },
  sizeIcon: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  sizeText: { flex: 1, color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
