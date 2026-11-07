import { useCallback, useEffect, useRef, useState } from 'react';

import { getBackend } from '@/platform/backend';

export type RecStatus = 'idle' | 'listening' | 'done';

/**
 * Windows konuşma tanıma (çevrimdışı). Kullanılamıyorsa `available` false olur,
 * sesli mod yazarak cevaplamaya geçer.
 */
export function useRecognizer(lang: string, enabled: boolean) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<RecStatus>('idle');
  const [heard, setHeard] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const session = useRef(0);

  useEffect(() => {
    alive.current = true;
    if (!enabled) {
      setAvailable(false);
      return;
    }
    getBackend()
      .speechAvailable(lang)
      .then((ok) => alive.current && setAvailable(ok));
    return () => {
      alive.current = false;
      getBackend().stopRecognition();
    };
  }, [lang, enabled]);

  const start = useCallback(
    (phrases: string[]) => {
      const id = ++session.current;
      setError(null);
      setHeard([]);
      setStatus('listening');
      getBackend()
        .recognize(lang, phrases)
        .then(
          (h) => {
            if (!alive.current || id !== session.current) return;
            setHeard(h);
            setStatus('done');
            if (h.length === 0) setError('Anlaşılamadı, tekrar dene.');
          },
          (e) => {
            if (!alive.current || id !== session.current) return;
            setStatus('idle');
            setError(typeof e === 'string' ? e : 'Mikrofon kullanılamadı.');
          },
        );
    },
    [lang],
  );

  const stop = useCallback(() => getBackend().stopRecognition(), []);

  const reset = useCallback(() => {
    session.current++;
    getBackend().stopRecognition();
    setStatus('idle');
    setHeard([]);
    setError(null);
  }, []);

  return { available, status, heard, error, start, stop, reset };
}
