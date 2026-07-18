import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AuthGate } from '@/components/auth-gate';
import { BottomNavigation } from '@/components/bottom-navigation';
import { migrateDatabase } from '@/database/migrations';
import { AuthProvider } from '@/providers/auth-provider';
import { SyncProvider } from '@/providers/sync-provider';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="accessories-shop.db" onInit={migrateDatabase}>
      <AuthProvider>
        <SyncProvider>
          <AuthGate>
            <StatusBar style="dark" />
            <View style={styles.app}>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.ink,
                  headerTitleStyle: { fontWeight: '800' },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: colors.background },
                }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="products/index" options={{ title: 'My stock' }} />
                <Stack.Screen name="products/new" options={{ title: 'Add a new product' }} />
                <Stack.Screen name="products/[id]" options={{ title: 'Add new stock' }} />
                <Stack.Screen name="products/qr/[id]" options={{ title: 'QR label' }} />
                <Stack.Screen name="scan" options={{ title: 'Scan and sell' }} />
                <Stack.Screen name="sell/[id]" options={{ title: 'Choose quantity' }} />
                <Stack.Screen name="sale" options={{ title: 'Current sale' }} />
                <Stack.Screen name="notifications" options={{ title: 'Stock alerts' }} />
                <Stack.Screen name="more" options={{ title: 'More' }} />
              </Stack>
              <BottomNavigation />
            </View>
          </AuthGate>
        </SyncProvider>
      </AuthProvider>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({ app: { flex: 1, backgroundColor: colors.background } });
