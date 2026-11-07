import { memo, useDeferredValue, useMemo, useState } from 'react';

import { C, Txt } from '@/components/Txt';
import { IconButton, Screen, Switch } from '@/components/ui';
import { VirtualList } from '@/components/VirtualList';
import { FONT_SCALE } from '@/core/settings';
import { LEVELS, type Level, type Word } from '@/core/types';
import { getWordsByLevel } from '@/core/words';
import { isPassive, nav, togglePassive, useStore } from '@/store/store';

/** 6 · Kelime listesi (aktif / pasif) */
export function Words({ level }: { level: Level }) {
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLocaleLowerCase('tr'));
  const scale = useStore((s) => FONT_SCALE[s.settings.fontSize]);
  const all = getWordsByLevel(level);
  const words = useMemo(() => (q ? all.filter((w) => w.search.includes(q)) : all), [all, q]);
  const passiveCount = useStore(() => countPassive(all));
  const rowHeight = Math.round(76 * scale);

  return (
    <Screen>
      <IconButton icon="back" label="Geri" />

      <Txt variant="display" size={36} style={{ marginTop: 12 }}>
        {level} kelimeleri
      </Txt>

      {/* Seviye değiştirici (Ayarlar > Pasif kelimeler'den gelindiğinde de işe yarar) */}
      <div className="row" role="tablist" style={{ gap: 8, marginTop: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        {LEVELS.map((l) => {
          const on = l === level;
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => !on && nav.replace({ name: 'words', level: l })}
              className={`chip press${on ? ' on' : ''}`}
            >
              <Txt variant="bold" size={14} color={on ? C.onAccent : C.text}>
                {l}
              </Txt>
            </button>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 14, gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <div className="col" style={{ flex: 1, minWidth: 200 }}>
          <Txt variant="bold" size={16} color={C.accent}>
            {all.length - passiveCount} aktif · {passiveCount} pasif
          </Txt>
          <Txt size={14} color={C.textMuted}>
            Kapattığın kelimeler çalışmada çıkmaz.
          </Txt>
        </div>
        <input
          className="input search"
          style={{ width: 220 }}
          type="search"
          placeholder="Ara (İngilizce / Türkçe)"
          aria-label="Kelime ara"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="list-box">
        <VirtualList
          items={words}
          rowHeight={rowHeight}
          getKey={(w) => w.id}
          resetKey={`${level}|${q}`}
          renderRow={(w, top) => <WordRow word={w} top={top} height={rowHeight} />}
          empty={
            <Txt size={15} color={C.textMuted} style={{ padding: 20 }}>
              {q ? 'Aramaya uyan kelime yok.' : 'Bu seviyede henüz kelime yok.'}
            </Txt>
          }
        />
      </div>
    </Screen>
  );
}

function countPassive(words: readonly Word[]) {
  let n = 0;
  for (const w of words) if (isPassive(w.id)) n++;
  return n;
}

/** Satır yalnızca kendi kelimesinin pasif durumu değişince yeniden çizilir. */
const WordRow = memo(function WordRow({ word, top, height }: { word: Word; top: number; height: number }) {
  const off = useStore(() => isPassive(word.id));
  return (
    <div className="word-row row" role="listitem" style={{ top, height }}>
      <div className="col" style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Txt variant={off ? 'medium' : 'bold'} size={18} color={off ? C.textDisabled : C.text} className={`ellipsis${off ? ' off' : ''}`}>
          {word.en}
        </Txt>
        <Txt size={15} color={off ? C.textDisabled : C.textMuted} className="ellipsis">
          {word.trAccepted.join(', ')}
        </Txt>
        {!!word.note && (
          <Txt size={13} color={C.textDisabled} className="ellipsis" title={word.note}>
            {word.note}
          </Txt>
        )}
      </div>
      <Switch value={!off} onChange={() => togglePassive(word.id)} label={`${word.en} kelimesini öner`} />
    </div>
  );
});
