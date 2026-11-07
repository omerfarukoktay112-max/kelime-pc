import { useState } from 'react';

import { Icon } from '@/components/Icon';
import { C, Txt } from '@/components/Txt';
import { IconButton, LinkButton, PrimaryButton, Screen } from '@/components/ui';
import { ROUND_OPTIONS } from '@/core/settings';
import { MATCH_BOARD_SIZE } from '@/core/session';
import { deckLabel, isLevel, type Deck, type StudyMode } from '@/core/types';
import { useKeys } from '@/lib/keys';
import { deckSize, getSnapshot, nav, setLastLevel, useStore } from '@/store/store';

const MODES: { id: StudyMode; title: string; desc: string }[] = [
  { id: 'choice', title: 'Çoktan seçmeli', desc: 'Kelime gelir, 4 karşılıktan birini seç' },
  { id: 'match', title: 'Eşleştirme', desc: `${MATCH_BOARD_SIZE} İngilizce kelimeyi Türkçe karşılığıyla eşleştir` },
  { id: 'speak', title: 'Sesli', desc: 'Türkçe kelime çıkar, İngilizcesini söyle ya da yaz' },
];

const ROUTE_OF = { choice: 'quiz', match: 'match', speak: 'speak' } as const;

/** 2 · Çalışma ayarı */
export function Setup({ deck }: { deck: Deck }) {
  const [mode, setMode] = useState<StudyMode>('choice');
  const [rounds, setRounds] = useState<number>(() => getSnapshot().settings.defaultRounds);
  // Pasif listesi ya da tekrar sayısı değişirse güncellenir
  const available = useStore((s) => deckSize(deck, s));

  const isLevelDeck = isLevel(deck);
  const canStart = available >= (mode === 'match' ? 2 : 1);

  const start = () => {
    if (!canStart) return;
    if (isLevel(deck)) setLastLevel(deck);
    nav.push({ name: ROUTE_OF[mode], deck, rounds });
  };

  useKeys((e) => {
    if (e.key === 'Enter') start();
    else if (e.key >= '1' && e.key <= '3') setMode(MODES[Number(e.key) - 1].id);
  });

  return (
    <Screen>
      <IconButton icon="back" label="Geri" />

      <div className="col" style={{ marginTop: 12, alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
        <div style={{ padding: '4px 12px', borderRadius: 12, background: C.accent }}>
          <Txt variant="bold" size={14} color={C.onAccent}>
            {deckLabel(deck)}
          </Txt>
        </div>
        <Txt variant="display" size={36}>
          Nasıl çalışalım?
        </Txt>
        {!isLevelDeck && (
          <Txt size={15} color={C.textMuted}>
            {deck === 'review'
              ? 'Tüm seviyelerden tekrar zamanı gelen kelimeler. Doğru bildiğin kelime birkaç gün sonra yeniden gelir.'
              : 'Son cevabını yanlış verdiğin kelimeler. Doğru bildiğinde listeden çıkar.'}
          </Txt>
        )}
      </div>

      <div className="scroll" style={{ paddingBottom: 16 }}>
        <div className="col" role="radiogroup" aria-label="Çalışma modu" style={{ marginTop: 28, gap: 10 }}>
          {MODES.map((m, i) => {
            const on = m.id === mode;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMode(m.id)}
                className={`row press ${on ? 'card-on' : 'card'}`}
                style={{ minHeight: 80, padding: '14px 18px', borderRadius: 20, gap: 16, borderWidth: 1.5, width: '100%' }}
              >
                <span className="kbd" style={{ color: on ? C.onAccent : C.textMuted }}>
                  {i + 1}
                </span>
                <div className="col" style={{ flex: 1, gap: 2 }}>
                  <Txt variant="bold" size={18} color={on ? C.onAccent : C.text}>
                    {m.title}
                  </Txt>
                  <Txt size={14} color={on ? C.onAccent : C.textMuted}>
                    {m.desc}
                  </Txt>
                </div>
                {on ? (
                  <span className="row" style={{ width: 28, height: 28, borderRadius: 14, background: C.onAccent, justifyContent: 'center' }}>
                    <Icon name="check" size={16} color={C.accent} strokeWidth={3} />
                  </span>
                ) : (
                  <span style={{ width: 28, height: 28, borderRadius: 14, border: `2px solid ${C.ring}` }} />
                )}
              </button>
            );
          })}
        </div>

        <div className="col" style={{ marginTop: 28, gap: 12 }}>
          <Txt variant="caps" size={14}>
            Tur sayısı
          </Txt>
          <div className="row" role="radiogroup" aria-label="Tur sayısı" style={{ gap: 10 }}>
            {ROUND_OPTIONS.map((n) => {
              const on = n === rounds;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRounds(n)}
                  className={`row press ${on ? 'card-on' : 'card'}`}
                  style={{ flex: 1, height: 56, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center' }}
                >
                  <Txt variant="bold" size={20} color={on ? C.onAccent : C.text}>
                    {n}
                  </Txt>
                </button>
              );
            })}
          </div>
          <Txt size={14} color={C.textMuted}>
            {mode === 'match' ? `Eşleştirmede her tur ${MATCH_BOARD_SIZE} kelimedir.` : `Bu destede ${available} kelime var.`}
          </Txt>
        </div>
      </div>

      <div className="col" style={{ gap: 4, flexShrink: 0 }}>
        {!canStart && (
          <Txt size={14} color={C.danger} style={{ textAlign: 'center', marginBottom: 8 }}>
            {isLevelDeck
              ? 'Bu seviyede çalışılacak aktif kelime yok.'
              : mode === 'match' && available === 1
                ? 'Eşleştirme için en az 2 kelime gerekiyor.'
                : 'Şu an burada çalışılacak kelime yok.'}
          </Txt>
        )}
        <PrimaryButton title="Başla" onPress={start} disabled={!canStart} hint="Enter" />
        {isLevel(deck) && <LinkButton title="Kelime listesini düzenle" onPress={() => nav.push({ name: 'words', level: deck })} />}
      </div>
    </Screen>
  );
}
