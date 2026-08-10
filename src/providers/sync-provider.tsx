import NetInfo from '@react-native-community/netinfo';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { synchronizeShop } from '@/services/sync';

type SyncState = {
  status: 'idle' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: string | null;
  error: string | null;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncState['status']>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeSync = useRef<Promise<void> | null>(null);

  const performSync = useCallback(async () => {
    if (!user) return;
    const network = await NetInfo.fetch();
    if (!network.isConnected || network.isInternetReachable === false) {
      setStatus('offline');
      setError('No internet connection. Local changes are safe on this phone.');
      throw new Error('No internet connection. Local changes are safe on this phone.');
    }
    try {
      setStatus('syncing');
      setError(null);
      const result = await synchronizeShop(db, user.uid);
      setLastSyncedAt(result.syncedAt);
      setStatus('idle');
    } catch (syncError) {
      setStatus('error');
      setError(syncError instanceof Error ? syncError.message : 'Synchronization failed.');
      throw syncError;
    }
  }, [db, user]);

  const syncNow = useCallback(() => {
    if (activeSync.current) return activeSync.current;
    const task = performSync().finally(() => { activeSync.current = null; });
    activeSync.current = task;
    return task;
  }, [performSync]);

  useEffect(() => {
    if (!user) return;
    const task = setTimeout(() => syncNow().catch(() => undefined), 0);
    return () => clearTimeout(task);
  }, [syncNow, user]);

  const value = useMemo(() => ({ status, lastSyncedAt, error, syncNow }), [error, lastSyncedAt, status, syncNow]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider.');
  return value;
}
