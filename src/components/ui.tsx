import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type StyleProp, type TextInputProps, View, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, error && styles.inputError]} {...props} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export const textStyles = StyleSheet.create({
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: '900' },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  body: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18 },
  button: { minHeight: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  fieldWrap: { gap: 7 },
  label: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.ink, fontSize: 16 },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12 },
});
