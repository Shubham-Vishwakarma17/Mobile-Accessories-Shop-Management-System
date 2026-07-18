import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { OWNER_UID } from '@/constants/config';
import { firebaseAuth, isFirebaseConfigured } from '@/services/firebase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(firebaseAuth?.currentUser ?? null);
  const [loading, setLoading] = useState(Boolean(firebaseAuth));

  useEffect(() => {
    const auth = firebaseAuth;
    if (!auth) return;
    return onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser && nextUser.uid !== OWNER_UID) {
        await signOut(auth);
        setUser(null);
      } else {
        setUser(nextUser);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: isFirebaseConfigured,
    login: async (email, password) => {
      if (!firebaseAuth) throw new Error('Firebase is not configured on this device.');
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (credential.user.uid !== OWNER_UID) {
        await signOut(firebaseAuth);
        throw new Error('This account is not authorized for this shop.');
      }
    },
    logout: async () => {
      if (firebaseAuth) await signOut(firebaseAuth);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
