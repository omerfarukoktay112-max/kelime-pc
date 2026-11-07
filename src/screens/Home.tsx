import { memo } from 'react';

import { LogoMark } from '@/components/Logo';
import { TabBar } from '@/components/TabBar';
import { Tree } from '@/components/Tree';
import { C, Txt } from '@/components/Txt';
import { ProgressBar, Screen } from '@/components/ui';
import { isThirsty, treeStage } from '@/core/tree';
import { LEVEL_NAMES, LEVELS, type Level } from '@/core/types';
import { levelTotal, nav, useStore } from '@/store/store';

/** 1 · Ana ekran: tekrar / hatalar + seviyeler */
export function Home() {
  const reviewCount = useStore((s) => s.reviewCount);
  const mistakeCount = useStore((s) => s.mistakeCount);
  const learned = useStore((s) => s.learned);
  const lastLevel = useStore((s) => s.lastLevel);
  const garden = useStore((s) => s.garden);

  return (
    <Screen>
      <div className="row" style={{ gap: 6, marginTop: 4, flexShrink: 0 }}>
        <LogoMark size={30} />
        <Txt variant="display" size={24} style={{ flex: 1 }}>
          kelime
        </Txt>
        <button type="button" aria-label="Ağacını gör" title="Ağacını gör" onClick={() => nav.tab('profile')}>
          <Tree stage={treeStage(garden.days)} thirsty={isThirsty(garden)} size={44} />
        </button>
      </div>

      <div className="scroll" style={{ paddingBottom: 16 }}>
        <div className="row" style={{ gap: 12, marginTop: 20, alignItems: 'stretch' }}>
          <DeckCard title="Tekrar" count={reviewCount} empty="Bugünlük tekrar yok" deck="review" />
          <DeckCard title="Hatalarım" count={mistakeCount} empty="Hata yok" deck="mistakes" />
        </div>

        <Txt variant="display" size={36} style={{ marginTop: 28, marginBottom: 20 }}>
          Seviyeni seç
        </Txt>

        <div className="level-grid">
          {LEVELS.map((level) => (
            <LevelCard key={level} level={level} highlighted={level === lastLevel} learned={learned[level]} />
          ))}
        </div>
      </div>

      <TabBar active="home" />
    </Screen>
  );
}

const DeckCard = memo(function DeckCard({
  title,
  count,
  empty,
  deck,
}: {
  title: string;
  count: number;
  empty: string;
  deck: 'review' | 'mistakes';
}) {
  const disabled = count === 0;
  return (
    <button
      type="button"
      aria-label={`${title}, ${count} kelime`}
      disabled={disabled}
      onClick={() => nav.push({ name: 'setup', deck })}
      className="deck-card press"
    >
      <Txt variant="bold" size={16}>
        {title}
      </Txt>
      {disabled ? (
        <Txt size={14} color={C.textMuted}>
          {empty}
        </Txt>
      ) : (
        <Txt variant="display" size={30} color={C.accent}>
          {count}
          <Txt inline variant="medium" size={14} color={C.textMuted}>
            {'  kelime'}
          </Txt>
        </Txt>
      )}
    </button>
  );
});

const LevelCard = memo(function LevelCard({ level, learned, highlighted }: { level: Level; learned: number; highlighted: boolean }) {
  const total = levelTotal(level);
  const fg = highlighted ? C.onAccent : C.text;
  const muted = highlighted ? C.onAccent : C.textMuted;
  return (
    <button
      type="button"
      aria-label={`${level} ${LEVEL_NAMES[level]}, ${learned} / ${total} öğrenildi`}
      onClick={() => nav.push({ name: 'setup', deck: level })}
      className={`level-card press ${highlighted ? 'card-on' : 'card'}`}
    >
      <div>
        <Txt variant="display" size={52} color={fg}>
          {level}
        </Txt>
        <Txt variant="medium" size={15} color={muted}>
          {LEVEL_NAMES[level]}
        </Txt>
      </div>
      <div className="col" style={{ gap: 8, width: '100%' }}>
        <Txt variant="bold" size={14} color={muted}>
          {learned} / {total}
        </Txt>
        <ProgressBar
          value={total ? learned / total : 0}
          height={6}
          track={highlighted ? C.onAccentTrack : C.border}
          fill={highlighted ? C.onAccent : C.accent}
        />
      </div>
    </button>
  );
});
