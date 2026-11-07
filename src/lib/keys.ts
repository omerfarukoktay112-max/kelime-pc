import { useEffect, useRef } from 'react';

/**
 * Ekrana özel klavye kısayolları. Bir metin kutusuna yazılırken (Enter/Esc hariç) ve onay penceresi
 * açıkken devre dışı kalır.
 * Son tanımlanan işleyici kullanılır; her tuşta yeniden kayıt yapılmaz.
 */
export function useKeys(handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      // Onay penceresi açıkken tuşlar pencerenin düğmelerine gider (Esc hariç: pencereyi kapatır)
      if (t?.closest?.('.dialog') && e.key !== 'Escape') return;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
      if (typing && e.key !== 'Enter' && e.key !== 'Escape') return;
      // Odak bir düğmedeyse Enter/Boşluk hem düğmeye tıklar hem kısayolu çalıştırırdı (ör. bir soru atlanırdı)
      if (t?.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
