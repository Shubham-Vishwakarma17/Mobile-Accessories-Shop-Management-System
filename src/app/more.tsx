import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, PrimaryButton, textStyles } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { colors } from '@/theme/colors';

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { status, lastSyncedAt, error, syncNow } = useSync();

  const sync = async () => {
    try {
      await syncNow();
      Alert.alert('Backup complete', 'Your latest shop information is saved online.');
    } catch {
      Alert.alert('Could not back up', 'Check your internet connection and try again.');
    }
  };

  return (
    <Screen>
      <View><Text style={textStyles.heading}>Backup and account</Text><Text style={textStyles.muted}>You normally do not need to change anything here.</Text></View>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Cloud backup</Text>
        <Text style={textStyles.muted}>{syncMessage(status, lastSyncedAt)}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={status === 'syncing' ? 'Backing up…' : 'Back up now'} onPress={sync} disabled={status === 'syncing'} />
      </Card>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Shop account</Text>
        <Text style={textStyles.muted}>{user?.email ?? 'Signed in'}</Text>
        <Pressable onPress={() => logout()} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>
      </Card>
      <Text style={styles.tip}>Before using the second phone, tap “Back up now” on this phone. Then open the app on the second phone while connected to the internet.</Text>
    </Screen>
  );
}

function syncMessage(status: string, date: string | null) {
  if (status === 'syncing') return 'Saving your shop information online…';
  if (status === 'offline') return 'The phone is offline. Your changes are still saved on this phone.';
  if (!date) return 'No cloud backup has completed in this session.';
  return `Last backed up ${new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
}

const styles = StyleSheet.create({
  card: { gap: 13 },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  signOut: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.dangerSoft },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '800' },
  tip: { color: colors.muted, backgroundColor: colors.primarySoft, borderRadius: 16, padding: 16, fontSize: 14, lineHeight: 21 },
});
