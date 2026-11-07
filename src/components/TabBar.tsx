import { nav } from '@/store/store';
import { Icon, type IconName } from './Icon';
import { C, Txt } from './Txt';

export type TabKey = 'home' | 'profile' | 'settings';

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Seviyeler', icon: 'levels' },
  { key: 'profile', label: 'Profil', icon: 'profile' },
  { key: 'settings', label: 'Ayarlar', icon: 'settings' },
];

/** Yuvarlak alt gezinme çubuğu. Ctrl+1/2/3 ile de geçilir. */
export function TabBar({ active }: { active: TabKey }) {
  return (
    <nav role="tablist" className="tabbar row">
      {TABS.map((t, i) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            title={`${t.label} (Ctrl+${i + 1})`}
            onClick={() => nav.tab(t.key)}
            className={`tab${on ? ' on' : ''}`}
          >
            <Icon name={t.icon} size={22} color={on ? C.onAccent : C.textMuted} />
            <Txt variant={on ? 'bold' : 'medium'} size={13} color={on ? C.onAccent : C.textMuted}>
              {t.label}
            </Txt>
          </button>
        );
      })}
    </nav>
  );
}
