import { useEffect } from 'react';

import { Overlays } from '@/components/Overlays';
import { useKeys } from '@/lib/keys';
import { Home } from '@/screens/Home';
import { Match } from '@/screens/Match';
import { Profile } from '@/screens/Profile';
import { Quiz } from '@/screens/Quiz';
import { Result } from '@/screens/Result';
import { Settings } from '@/screens/Settings';
import { Setup } from '@/screens/Setup';
import { Speak } from '@/screens/Speak';
import { Words } from '@/screens/Words';
import { getBackend } from '@/platform/backend';
import { currentRoute, nav, useStore, type Keyed } from '@/store/store';

function Route({ r }: { r: Keyed }) {
  switch (r.name) {
    case 'home':
      return <Home />;
    case 'profile':
      return <Profile />;
    case 'settings':
      return <Settings />;
    case 'setup':
      return <Setup deck={r.deck} />;
    case 'words':
      return <Words level={r.level} />;
    case 'quiz':
      return <Quiz deck={r.deck} rounds={r.rounds} />;
    case 'match':
      return <Match deck={r.deck} rounds={r.rounds} />;
    case 'speak':
      return <Speak deck={r.deck} rounds={r.rounds} />;
    case 'result':
      return <Result deck={r.deck} rounds={r.rounds} mode={r.mode} correct={r.correct} total={r.total} />;
  }
}

export function App() {
  const route = useStore((s) => currentRoute(s));

  // Esc: geri / pencereyi kapat. Ctrl+1/2/3: ana sekmeler (useKeys Ctrl'lü tuşları geçirmediği için ayrı dinlenir)
  useKeys((e) => {
    if (e.key === 'Escape') nav.back();
  });
  // Pencere gizli açılır; ilk çizim hazır olunca gösterilir. (requestAnimationFrame'e bağlanmaz:
  // gizli pencerede WebView2 kare çizmeyi duraklatabilir.)
  useEffect(() => getBackend().showWindow(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        nav.tab((['home', 'profile', 'settings'] as const)[Number(e.key) - 1]);
      } else if (e.altKey && e.key === 'ArrowLeft') {
        nav.back();
      }
    };
    // Faredeki "geri" tuşu
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        nav.back();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mouseup', onMouse);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mouseup', onMouse);
    };
  }, []);

  return (
    <>
      <Route key={route.key} r={route} />
      <Overlays />
    </>
  );
}
