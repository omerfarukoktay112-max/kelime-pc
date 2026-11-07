import { C, Txt } from '@/components/Txt';
import { LinkButton, PrimaryButton, ProgressBar, Screen, Spacer } from '@/components/ui';
import { dayKey } from '@/core/tree';
import { deckLabel, isLevel, type Deck, type StudyMode } from '@/core/types';
import { useKeys } from '@/lib/keys';
import { deckSize, levelTotal, nav, todayCount, useStore } from '@/store/store';

const MODE_TITLES: Record<StudyMode, string> = {
  choice: 'Çoktan seçmeli',
  match: 'Eşleştirme',
  speak: 'Sesli',
};
const ROUTE_OF = { choice: 'quiz', match: 'match', speak: 'speak' } as const;

/** Tur sonu özeti */
export function Result({
  deck,
  rounds,
  mode,
  correct,
  total,
}: {
  deck: Deck;
  rounds: number;
  mode: StudyMode;
  correct: number;
  total: number;
}) {
  const today = useStore((s) => todayCount(s));
  const dailyGoal = useStore((s) => s.settings.dailyGoal);
  const watered = useStore((s) => s.garden.last === dayKey());
  const remaining = useStore((s) => deckSize(deck, s));
  const learned = useStore((s) => (isLevel(deck) ? s.learned[deck] : 0));

  const ratio = total ? correct / total : 0;
  const headline = ratio >= 0.9 ? 'Harika!' : ratio >= 0.6 ? 'İyi gidiyor' : 'Biraz daha pratik';
  const deckStat = isLevel(deck)
    ? { label: `${deck} öğrenilen`, value: `${learned} / ${levelTotal(deck)}` }
    : { label: deck === 'review' ? 'Kalan tekrar' : 'Kalan hata', value: String(remaining) };

  const again = () => remaining > 0 && nav.replace({ name: ROUTE_OF[mode], deck, rounds });

  useKeys((e) => {
    if (e.key === 'Enter') again();
  });

  return (
    <Screen style={{ paddingBottom: 24 }}>
      <div className="col" style={{ marginTop: 48, gap: 8 }}>
        <Txt variant="caps" size={14}>
          {deckLabel(deck)} · {MODE_TITLES[mode]}
        </Txt>
        <Txt variant="display" size={44}>
          {headline}
        </Txt>
      </div>

      <div style={{ marginTop: 28, padding: 22, borderRadius: 28, background: C.accent }}>
        <Txt variant="bold" size={15} color={C.onAccent}>
          {mode === 'match' ? 'İlk denemede doğru' : 'Doğru cevap'}
        </Txt>
        <div className="row" style={{ alignItems: 'baseline', gap: 10, margin: '8px 0' }}>
          <Txt variant="display" size={72} color={C.onAccent}>
            {correct}
          </Txt>
          <Txt variant="medium" size={18} color={C.onAccent}>
            / {total}
          </Txt>
        </div>
        <ProgressBar value={ratio} track={C.onAccentTrack} fill={C.onAccent} />
      </div>

      <div className="col" style={{ marginTop: 24, gap: 14 }}>
        <Stat label={deckStat.label} value={deckStat.value} />
        <Stat label="Bugünkü hedef" value={`${Math.min(today, dailyGoal)} / ${dailyGoal}`} />
      </div>

      {watered && (
        <Txt variant="medium" size={15} color={C.textMuted} style={{ marginTop: 16, textAlign: 'center' }}>
          Bugünkü hedef tamam, ağacın sulandı.
        </Txt>
      )}

      <Spacer />

      <div className="col" style={{ gap: 4 }}>
        {remaining > 0 && <PrimaryButton title="Tekrar çalış" onPress={again} hint="Enter" />}
        <LinkButton title="Ana ekrana dön" onPress={nav.home} />
      </div>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card row" style={{ minHeight: 60, padding: '0 18px', borderRadius: 20 }}>
      <Txt variant="medium" size={17} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant="bold" size={17} color={C.accent}>
        {value}
      </Txt>
    </div>
  );
}
