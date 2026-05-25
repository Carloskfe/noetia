'use client';

import { useEffect, useRef } from 'react';

const INTERVAL_MS = 60_000;

export function useReadingHeartbeat(bookId: string | null, phraseIndex: number) {
  const lastPhraseRef = useRef<number>(phraseIndex);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      tokenRef.current = localStorage.getItem('noetia_token');
    }
  }, []);

  useEffect(() => {
    lastPhraseRef.current = phraseIndex;
  }, [phraseIndex]);

  useEffect(() => {
    if (!bookId) return;

    let prevPhrase = lastPhraseRef.current;

    const send = () => {
      if (document.hidden) return;
      const token = tokenRef.current ?? localStorage.getItem('noetia_token');
      if (!token) return;
      const phraseDelta = Math.max(0, lastPhraseRef.current - prevPhrase);
      prevPhrase = lastPhraseRef.current;
      fetch('/api/stats/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookId, phraseDelta }),
      }).catch(() => {});
    };

    const id = setInterval(send, INTERVAL_MS);
    return () => clearInterval(id);
  }, [bookId]);
}
