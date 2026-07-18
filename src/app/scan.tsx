import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { findVariantByQr } from '@/database/repository';
import { colors } from '@/theme/colors';

export default function ScanScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const scanLock = useRef(false);

  const scan = useCallback(async ({ data }: BarcodeScanningResult) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setLocked(true);
    try {
      const item = await findVariantByQr(db, data);
      if (!item) throw new Error('This QR code does not belong to a product in this shop.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/sell/[id]', params: { id: item.id } });
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Item not sold', error instanceof Error ? error.message : 'Could not read this QR code.');
      scanLock.current = false;
      setLocked(false);
    }
  }, [db, router]);

  if (!permission) return <View style={styles.permission} />;
  if (!permission.granted) {
    return <SafeAreaView style={styles.permission}><Text style={styles.permissionTitle}>Camera access is needed to scan product QR codes.</Text><PrimaryButton label="Allow camera" onPress={requestPermission} /></SafeAreaView>;
  }

  return (
    <View style={styles.page}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={locked ? undefined : scan} />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topCopy}><Text style={styles.title}>Place the QR inside the frame</Text><Text style={styles.subtitle}>Each successful scan immediately removes one piece from stock.</Text></View>
        <View style={styles.frame} />
        <View style={styles.bottom}>
          <View style={styles.tip}><Text style={styles.tipTitle}>One scan only</Text><Text style={styles.tipText}>After a QR is found, you will choose the quantity before any stock is changed.</Text></View>
          <Pressable onPress={() => router.replace('/sale')} style={styles.saleButton}><Text style={styles.saleButtonText}>Open current sale</Text></Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, padding: 22, justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  topCopy: { alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.62)', padding: 18, borderRadius: 18 },
  title: { color: colors.white, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: '#D4DDD7', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 },
  frame: { width: 260, height: 260, borderWidth: 3, borderColor: colors.accent, borderRadius: 28 },
  bottom: { alignSelf: 'stretch', gap: 12 },
  tip: { backgroundColor: colors.surface, padding: 16, borderRadius: 17 },
  tipTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  tipText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  saleButton: { minHeight: 52, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  saleButtonText: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  permission: { flex: 1, padding: 24, gap: 20, justifyContent: 'center', backgroundColor: colors.background },
  permissionTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', textAlign: 'center' },
});
