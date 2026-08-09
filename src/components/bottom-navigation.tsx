import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

const items: { label: string; icon: string; path: '/' | '/products' | '/scan' | '/sale' | '/notifications' | '/repairs'; primary?: boolean }[] = [
  { label: 'Home', icon: '⌂', path: '/' },
  { label: 'Stock', icon: '▤', path: '/products' },
  { label: 'Scan', icon: '▣', path: '/scan', primary: true },
  { label: 'Sale', icon: '₹', path: '/sale' },
  { label: 'Alerts', icon: '!', path: '/notifications' },
  { label: 'Repairs', icon: '⌕', path: '/repairs' },
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
            <Text adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.8} style={[styles.label, active && styles.activeText]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 7, paddingHorizontal: 3 },
  item: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2, gap: 3 },
  iconWrap: { width: 38, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeIcon: { backgroundColor: colors.primarySoft },
  primaryIcon: { backgroundColor: colors.primary },
  icon: { color: colors.muted, fontSize: 19, lineHeight: 21, fontWeight: '900', textAlign: 'center' },
  primaryIconText: { color: colors.white },
  label: { width: '100%', color: colors.muted, fontSize: 10, lineHeight: 13, fontWeight: '700', textAlign: 'center' },
  activeText: { color: colors.primary },
});
