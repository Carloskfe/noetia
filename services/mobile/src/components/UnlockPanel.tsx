import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AccessDenial,
  TOKENS_URL,
  UnlockOutcome,
  fetchAvailableTokens,
  unlockBook,
} from '../api/acquisition';
import { useTranslation } from '../i18n';

// "Unlock with token" (NEM-012). Paid books are acquired only by redeeming a
// token (PO-021 Amendment 1) — never a per-title purchase.

type Props = {
  bookId: string;
  bookTitle?: string;
  reason?: AccessDenial['reason'];
  /** True when the user can read the book now (legacy plan access) but does not own it. */
  readableWithPlan?: boolean;
  onUnlocked: () => void;
  onClose?: () => void;
};

export function UnlockPanel({ bookId, bookTitle, reason, readableWithPlan, onUnlocked, onClose }: Props) {
  const { t } = useTranslation();
  const a = t.acquisition;
  const [tokens, setTokens] = useState<number | null | undefined>(undefined);
  const [unlocking, setUnlocking] = useState(false);
  const [outcome, setOutcome] = useState<UnlockOutcome | null>(null);

  useEffect(() => {
    let live = true;
    fetchAvailableTokens().then((n) => { if (live) setTokens(n); });
    return () => { live = false; };
  }, []);

  async function handleUnlock() {
    if (unlocking) return;
    setUnlocking(true);
    setOutcome(null);
    const result = await unlockBook(bookId);
    if (result === 'unlocked' || result === 'already_owned') {
      onUnlocked();
      return;
    }
    if (result === 'no_tokens') setTokens(0);
    setOutcome(result);
    setUnlocking(false);
  }

  const outOfTokens = tokens === 0 || outcome === 'no_tokens';

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.title}>{a.title}</Text>
      {bookTitle ? <Text style={styles.book}>{bookTitle}</Text> : null}
      <Text style={styles.body}>{readableWithPlan ? a.readingWithPlan : a.subtitle}</Text>
      {reason === 'payment_required' ? <Text style={styles.warn}>{a.paymentPending}</Text> : null}

      {tokens === undefined ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={styles.balance}>{a.checkingBalance}</Text>
        </View>
      ) : tokens === null ? null : (
        <Text style={styles.balance}>{a.balance(tokens)}</Text>
      )}

      {outcome === 'email_unconfirmed' ? <Text style={styles.error}>{a.confirmEmail}</Text> : null}
      {outcome === 'error' || outcome === 'not_found' ? <Text style={styles.error}>{a.error}</Text> : null}

      {outOfTokens ? (
        <>
          <Text style={styles.body}>{a.noTokens}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => Linking.openURL(TOKENS_URL)} accessibilityRole="link">
            <Text style={styles.primaryText}>{a.getTokens}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.primary, (unlocking || tokens === undefined) && styles.disabled]}
            onPress={handleUnlock}
            disabled={unlocking || tokens === undefined}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{unlocking ? a.unlocking : a.unlock}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(TOKENS_URL)} accessibilityRole="link">
            <Text style={styles.link}>{a.getTokens}</Text>
          </TouchableOpacity>
        </>
      )}

      {onClose ? (
        <TouchableOpacity onPress={onClose} accessibilityRole="button">
          <Text style={styles.close}>{a.close}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  book: { marginTop: 4, fontSize: 14, fontWeight: '600', color: '#1F2937', textAlign: 'center' },
  body: { marginTop: 12, fontSize: 14, color: '#4B5563', textAlign: 'center' },
  warn: { marginTop: 8, fontSize: 12, color: '#B45309', textAlign: 'center' },
  row: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  balance: { marginTop: 16, fontSize: 14, fontWeight: '600', color: '#111827' },
  error: { marginTop: 12, fontSize: 14, color: '#DC2626', textAlign: 'center' },
  primary: { marginTop: 16, alignSelf: 'stretch', backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  link: { marginTop: 12, fontSize: 14, fontWeight: '600', color: '#4F46E5' },
  close: { marginTop: 16, fontSize: 14, color: '#6B7280' },
});
