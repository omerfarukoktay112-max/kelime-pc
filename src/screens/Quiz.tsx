import { useEffect, useState } from 'react';

import { Icon } from '@/components/Icon';
import { C, Txt } from '@/components/Txt';
import { PrimaryButton, Screen, Spacer, StudyHeader } from '@/components/ui';
import { buildChoiceQuestion, pickStudyWords, type ChoiceQuestion } from '@/core/session';
import { isLevel, type Deck } from '@/core/types';
import { useKeys } from '@/lib/keys';
import { answerFeedback } from '@/lib/sfx';
import { speakEnglish, stopSpeaking } from '@/lib/speech';
import { deckWords, getSnapshot, getStat, nav, recordAnswer, useStore } from '@/store/store';

/** 3 · Çoktan seçmeli */
export function Quiz({ deck, rounds }: { deck: Deck; rounds: number }) {
  const settings = useStore((s) => s.settings);
  // Sorular ekran açılınca bir kez üretilir
  const [questions] = useState<ChoiceQuestion[]>(() => {
    const dir = getSnapshot().settings.direction;
    return pickStudyWords(deckWords(deck), rounds, getStat, isLevel(deck)).map((w) => buildChoiceQuestion(w, dir));
  });
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const q = questions[idx];
  const englishShown = q ? q.prompt === q.word.en : true;

  useEffect(() => {
    if (q && englishShown && settings.autoplay) speakEnglish(q.word.en, settings);
    return stopSpeaking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const pick = (i: number) => {
    if (picked !== null || !q || i >= q.options.length) return;
    const ok = i === q.correctIndex;
    setPicked(i);
    if (ok) setCorrectCount((n) => n + 1);
    recordAnswer(q.word.id, ok);
    answerFeedback(ok, settings);
    if (!englishShown && settings.autoplay) speakEnglish(q.word.en, settings);
  };

  const next = () => {
    if (picked === null) return;
    if (idx + 1 >= questions.length) {
      nav.replace({ name: 'result', deck, rounds, mode: 'choice', correct: correctCount, total: questions.length });
      return;
    }
    setIdx(idx + 1);
    setPicked(null);
  };

  useKeys((e) => {
    if (e.key === 'Enter') return next();
    if (e.key === ' ') {
      e.preventDefault();
      if (q) speakEnglish(q.word.en, settings);
      return;
    }
    const n = '1234'.indexOf(e.key);
    const a = 'abcd'.indexOf(e.key.toLowerCase());
    if (n >= 0 || a >= 0) pick(n >= 0 ? n : a);
  });

  if (!q) {
    return (
      <Screen>
        <StudyHeader current={0} total={0} />
        <Txt style={{ marginTop: 40 }}>Bu destede çalışılacak kelime yok.</Txt>
      </Screen>
    );
  }

  const answered = picked !== null;

  return (
    <Screen style={{ paddingBottom: 24 }}>
      <StudyHeader current={idx + 1} total={questions.length} />

      <div className="col" style={{ marginTop: 44, alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <Txt variant="caps" size={14}>
          {englishShown ? 'İngilizce' : 'Türkçe'}
        </Txt>
        <div className="row" style={{ gap: 12, maxWidth: '100%' }}>
          <Txt variant="display" size={q.prompt.length > 10 ? 44 : 64} style={{ textAlign: 'center', overflowWrap: 'anywhere' }}>
            {q.prompt}
          </Txt>
          {englishShown && (
            <button
              type="button"
              aria-label="Kelimeyi sesli dinle"
              title="Dinle (Boşluk)"
              onClick={() => speakEnglish(q.word.en, settings)}
              className="row press"
              style={{ width: 48, height: 48, borderRadius: 24, border: `1.5px solid ${C.ring}`, justifyContent: 'center', flexShrink: 0 }}
            >
              <Icon name="speaker" color={C.accent} />
            </button>
          )}
        </div>
      </div>

      <div className="col" style={{ marginTop: 40, gap: 12 }}>
        {q.options.map((label, i) => {
          const isCorrect = answered && i === q.correctIndex;
          const isWrong = answered && i === picked && i !== q.correctIndex;
          return (
            <button
              key={`${idx}-${i}`}
              type="button"
              disabled={answered}
              onClick={() => pick(i)}
              className={`option row press ${isCorrect ? 'opt-correct' : isWrong ? 'opt-wrong' : 'opt-default'}`}
            >
              <span className="kbd" style={{ color: isCorrect ? C.onAccent : C.textMuted }}>
                {i + 1}
              </span>
              <Txt
                variant={isCorrect ? 'bold' : 'medium'}
                size={label.length > 28 ? 16 : 20}
                color={isCorrect ? C.onAccent : C.text}
                style={{ flex: 1, textDecoration: isWrong ? 'line-through' : undefined }}
              >
                {label}
              </Txt>
              {isCorrect && <Icon name="check" color={C.onAccent} strokeWidth={3} />}
              {isWrong && <Icon name="close" color={C.text} strokeWidth={3} />}
            </button>
          );
        })}
      </div>

      <Spacer />

      {answered ? (
        <PrimaryButton title={idx + 1 >= questions.length ? 'Bitir' : 'Devam'} onPress={next} hint="Enter" />
      ) : (
        <div className="row" style={{ height: 60, justifyContent: 'center', flexShrink: 0 }}>
          <Txt size={16} color={C.textMuted}>
            Doğru karşılığı seç · 1–4
          </Txt>
        </div>
      )}
    </Screen>
  );
}
