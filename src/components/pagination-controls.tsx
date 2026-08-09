import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export function PaginationControls({ page, totalPages, totalItems, onPageChange }: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return totalItems > 0 ? <Text style={styles.single}>{totalItems} items</Text> : null;
  return (
    <View style={styles.wrap}>
      <Pressable disabled={page <= 1} onPress={() => onPageChange(page - 1)} style={[styles.button, page <= 1 && styles.disabled]}>
        <Text style={styles.buttonText}>Previous</Text>
      </Pressable>
      <View style={styles.status}><Text style={styles.page}>Page {page} of {totalPages}</Text><Text style={styles.total}>{totalItems} items</Text></View>
      <Pressable disabled={page >= totalPages} onPress={() => onPageChange(page + 1)} style={[styles.button, page >= totalPages && styles.disabled]}>
        <Text style={styles.buttonText}>Next</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8 },
  button: { minHeight: 42, minWidth: 82, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 13, backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  status: { alignItems: 'center' },
  page: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  total: { color: colors.muted, fontSize: 11, marginTop: 2 },
  single: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
});
