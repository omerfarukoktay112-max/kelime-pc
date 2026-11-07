import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
import { App } from './App';
import { FONT_SCALE } from './core/settings';
import { stopSpeaking } from './lib/speech';
import { getBackend, initBackend } from './platform/backend';
import { getSnapshot, loadFromBackend, refreshIfDayChanged, subscribe } from './store/store';

/** Tema ve yazı boyutu doğrudan <html>'e uygulanır; React ağacı yeniden çizilmez. */
function applyAppearance() {
  let theme = '';
  let fontSize = '';
  const apply = () => {
    const s = getSnapshot().settings;
    if (s.theme !== theme) {
      theme = s.theme;
      document.documentElement.dataset.theme = theme;
      getBackend().setWindowTheme(s.theme);
    }
    if (s.fontSize !== fontSize) {
      fontSize = s.fontSize;
      document.documentElement.style.setProperty('--fs', String(FONT_SCALE[s.fontSize]));
    }
  };
  apply();
  subscribe(apply);
}

/** Pencere gizlenince / simge durumuna küçülünce: seslendirme durur, animasyonlar duraklar. */
function watchVisibility() {
  const onChange = () => {
    const hidden = document.visibilityState === 'hidden';
    document.documentElement.classList.toggle('hidden', hidden);
    if (hidden) stopSpeaking();
    else refreshIfDayChanged();
  };
  document.addEventListener('visibilitychange', onChange);
  window.addEventListener('focus', refreshIfDayChanged);
}

async function start() {
  await initBackend();
  await loadFromBackend();
  applyAppearance();
  watchVisibility();

  // Sağ tık menüsü (Yenile / İncele) masaüstü uygulamasında gereksiz; metin kutularında kalsın
  if (getBackend().desktop && !import.meta.env.DEV) {
    window.addEventListener('contextmenu', (e) => {
      const t = e.target as HTMLElement;
      if (t.tagName !== 'INPUT') e.preventDefault();
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
