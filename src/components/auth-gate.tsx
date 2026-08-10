import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PrimaryButton, textStyles } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme/colors';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, configured, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /><Text style={textStyles.muted}>Opening your shop…</Text></View>;
  }
  if (user) return children;

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter the shop email and password.');
      return;
    }
    try {
      setSubmitting(true);
      await login(email, password);
    } catch (error) {
      Alert.alert('Could not sign in', readableAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator>
          <View style={styles.brand}><Text style={styles.mark}>MAS</Text><Text style={textStyles.eyebrow}>Mobile Accessories Shop</Text><Text style={textStyles.title}>Your stock, always in hand.</Text><Text style={textStyles.muted}>Use the single shop account on the currently active phone.</Text></View>
          <View style={styles.form}>
            {!configured ? <Text style={styles.configError}>Firebase configuration is missing. Add the values to .env and restart Expo.</Text> : null}
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="shop@example.com" />
            <View style={styles.passwordWrap}>
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                placeholder="Your password"
                onSubmitEditing={submit}
                returnKeyType="done"
                style={styles.passwordInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                hitSlop={10}
                onPress={() => setPasswordVisible((visible) => !visible)}
                style={({ pressed }) => [styles.passwordToggle, pressed && styles.togglePressed]}>
                <Text style={styles.passwordToggleText}>{passwordVisible ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
            <PrimaryButton label={submitting ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={submitting || !configured} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function readableAuthError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('invalid-credential')) return 'The email or password is incorrect.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a moment and try again.';
  if (code.includes('network-request-failed')) return 'Check your internet connection and try again.';
  return error instanceof Error ? error.message : 'Please try again.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, gap: 34 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.background },
  brand: { gap: 9 },
  mark: { width: 64, height: 64, borderRadius: 20, textAlign: 'center', textAlignVertical: 'center', backgroundColor: colors.primary, color: colors.white, fontSize: 20, fontWeight: '900', marginBottom: 8 },
  form: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 17 },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 70 },
  passwordToggle: { position: 'absolute', right: 14, bottom: 14, minWidth: 42, alignItems: 'center' },
  passwordToggleText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  togglePressed: { opacity: 0.55 },
  configError: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 12, lineHeight: 19 },
});
