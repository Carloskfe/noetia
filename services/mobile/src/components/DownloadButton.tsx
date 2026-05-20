import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { downloadBook } from '../offline/book-download';
import { isBookDownloaded, removeBook } from '../offline/book-storage';
import { useTranslation } from '../i18n';

type State = 'idle' | 'downloading' | 'downloaded' | 'error';

interface Props {
  bookId: string;
}

export function DownloadButton({ bookId }: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    isBookDownloaded(bookId).then((yes) => setState(yes ? 'downloaded' : 'idle'));
  }, [bookId]);

  async function handleDownload() {
    setState('downloading');
    try {
      await downloadBook(bookId);
      setState('downloaded');
    } catch {
      setState('error');
    }
  }

  function handleDownloaded() {
    Alert.alert(t.download.deleteTitle, t.download.deleteConfirm, [
      { text: t.download.cancel, style: 'cancel' },
      {
        text: t.download.delete,
        style: 'destructive',
        onPress: async () => {
          await removeBook(bookId);
          setState('idle');
        },
      },
    ]);
  }

  if (state === 'downloading') {
    return <ActivityIndicator style={styles.btn} size="small" color="#4F46E5" />;
  }

  if (state === 'downloaded') {
    return (
      <TouchableOpacity onPress={handleDownloaded} style={styles.btn} accessibilityLabel={t.download.downloaded}>
        <Text style={styles.iconDone}>✓</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleDownload}
      style={styles.btn}
      accessibilityLabel={state === 'error' ? t.download.error : t.download.download}
    >
      <Text style={state === 'error' ? styles.iconError : styles.icon}>⬇</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:       { padding: 8, marginRight: 4 },
  icon:      { fontSize: 18, color: '#4F46E5' },
  iconDone:  { fontSize: 18, color: '#10B981', fontWeight: '700' },
  iconError: { fontSize: 18, color: '#EF4444' },
});
