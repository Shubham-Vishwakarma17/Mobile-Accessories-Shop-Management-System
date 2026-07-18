import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

const items: { label: string; icon: string; path: '/' | '/products' | '/scan' | '/sale' | '/notifications'; primary?: boolean }[] = [
  { label: 'Home', icon: '⌂', path: '/' },
  { label: 'Stock', icon: '▤', path: '/products' },
  { label: 'Scan', icon: '▣', path: '/scan', primary: true },
  { label: 'Sale', icon: '₹', path: '/sale' },
  { label: 'Alerts', icon: '!', path: '/notifications' },
];

export function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((item) => {
        const active = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.path}
            onPress={() => router.replace(item.path)}
            style={styles.item}>
            <View style={[styles.iconWrap, item.primary && styles.primaryIcon, active && !item.primary && styles.activeIcon]}>
              <Text style={[styles.icon, item.primary && styles.primaryIconText, active && !item.primary && styles.activeText]}>{item.icon}</Text>
            </View>
            <Text style={[styles.label, active && styles.activeText]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, paddingHorizontal: 6 },
  item: { flex: 1, minHeight: 55, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconWrap: { minWidth: 36, height: 28, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activeIcon: { backgroundColor: colors.primarySoft },
  primaryIcon: { width: 48, height: 38, borderRadius: 16, backgroundColor: colors.primary, marginTop: -18, borderWidth: 3, borderColor: colors.surface },
  icon: { color: colors.muted, fontSize: 20, lineHeight: 22, fontWeight: '900' },
  primaryIconText: { color: colors.white, fontSize: 21 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  activeText: { color: colors.primary },
});
