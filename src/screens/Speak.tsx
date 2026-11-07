import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/Icon';
import { C, Txt } from '@/components/Txt';
import { LinkButton, PrimaryButton, Screen, Spacer, StudyHeader } from '@/components/ui';
import { matchSpoken } from '@/core/answer';
import { pickStudyWords, speechPhrases } from '@/core/session';
import { isLevel, type Deck, type Word } from '@/core/types';
import { useKeys } from '@/lib/keys';
import { useRecognizer } from '@/lib/useRecognizer';
import { answerFeedback } from '@/lib/sfx';
import { speakEnglish, stopSpeaking } from '@/lib/speech';
import { getBackend } from '@/platform/backend';
import { deckWords, getStat, nav, recordAnswer, useStore } from '@/store/store';

/** 5 · Sesli — Türkçe kelime gösterilir, İngilizcesi söylenir ya da yazılır */
export function Speak({ deck, rounds }: { deck: Deck; rounds: number }) {
  const settings = useStore((s) => s.settings);
  const rec = useRecognizer(settings.accent, settings.microphone);
  // Mikrofon ayarda kapalıysa ya da konuşma tanıma yoksa yazarak cevaplanır
  const voice = rec.available === true;

  const [words] = useState<Word[]>(() => pickStudyWords(deckWords(deck), rounds, getStat, isLevel(deck)));
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; matched: string | null; heard: string } | null>(null);
  const [typed, setTyped] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const w = words[idx];

  const evaluate = (heard: string[]) => {
    if (!w || result) return;
    const matched = matchSpoken(heard, w.enAccepted);
    const ok = matched !== null;
    setResult({ ok, matched, heard: heard[0] ?? '' });
    if (ok) setCorrectCount((n) => n + 1);
    recordAnswer(w.id, ok);
    answerFeedback(ok, settings);
    if (settings.autoplay) speakEnglish(w.en, settings);
  };

  // Konuşma tanıma bitince değerlendir
  useEffect(() => {
    if (rec.status === 'done' && rec.heard.length > 0) evaluate(rec.heard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.status]);

  // Yazma modunda kutu hep hazır olsun
  useEffect(() => {
    if (!voice && !result) inputRef.current?.focus();
  }, [voice, result, idx]);

  useEffect(() => stopSpeaking, []);

  const next = () => {
    rec.reset();
    if (idx + 1 >= words.length) {
      nav.replace({ name: 'result', deck, rounds, mode: 'speak', correct: correctCount, total: words.length });
      return;
    }
    setIdx(idx + 1);
    setResult(null);
    setTyped('');
  };

  const listening = rec.status === 'listening';
  const toggleMic = () => {
    if (!w || result) return;
    if (listening) rec.stop();
    else {
      stopSpeaking();
      rec.start(speechPhrases(w));
    }
  };

  useKeys((e) => {
    if (e.key === 'Enter') {
      if (result) next();
      else if (!voice && typed.trim()) evaluate([typed]);
    } else if (e.key === ' ' && voice) {
      e.preventDefault();
      toggleMic();
    }
  });

  if (!w) {
    return (
      <Screen>
        <StudyHeader current={0} total={0} />
        <Txt style={{ marginTop: 40 }}>Bu destede çalışılacak kelime yok.</Txt>
      </Screen>
    );
  }

  const long = w.tr.length > 10;

  return (
    <Screen style={{ paddingBottom: 24 }}>
      <StudyHeader current={idx + 1} total={words.length} />

      <div className="col" style={{ marginTop: 56, alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <Txt variant="caps" size={14}>
          Türkçe
        </Txt>
        <Txt variant="display" size={long ? 48 : 80} style={{ textAlign: 'center', overflowWrap: 'anywhere' }}>
          {w.tr.charAt(0).toLocaleUpperCase('tr') + w.tr.slice(1)}
        </Txt>
        <Txt size={18} color={C.textMuted} style={{ marginTop: 4 }}>
          İngilizcesini {voice ? 'söyle' : 'yaz'}
        </Txt>
      </div>

      {voice ? (
        <div className="col" style={{ marginTop: 44, alignItems: 'center' }}>
          <div className={`mic-ring${listening ? ' listening' : ''}`}>
            <button
              type="button"
              aria-label={listening ? 'Dinlemeyi bitir' : 'Konuşmak için tıkla'}
              title="Boşluk"
              disabled={!!result}
              onClick={toggleMic}
              className="mic press"
            >
              <Icon name="mic" size={48} color={C.onAccent} />
            </button>
          </div>
          <Txt size={15} color={C.textMuted} style={{ marginTop: 12, minHeight: 20 }}>
            {listening ? 'Dinleniyor…' : rec.error ? rec.error : result ? '' : 'Tıkla (ya da Boşluk) ve söyle'}
          </Txt>
        </div>
      ) : (
        <div className="col" style={{ marginTop: 40, gap: 12 }}>
          <input
            ref={inputRef}
            className="input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={!!result}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder="İngilizce karşılık"
            aria-label="İngilizce karşılık"
          />
          {!result && <PrimaryButton title="Kontrol et" onPress={() => evaluate([typed])} disabled={!typed.trim()} hint="Enter" />}
          {rec.available === false && settings.microphone && (
            <Txt size={13} color={C.textDisabled} style={{ textAlign: 'center' }}>
              {getBackend().desktop
                ? 'Windows konuşma tanıma bulunamadı. Ayarlar > Saat ve dil > Konuşma bölümünden İngilizce konuşma paketini yükleyince mikrofonla da cevaplayabilirsin.'
                : 'Konuşma tanıma yalnızca Windows uygulamasında var.'}
            </Txt>
          )}
        </div>
      )}

      {result && (
        <div className="col" style={{ marginTop: 28, alignItems: 'center', gap: 12 }}>
          <Txt variant="caps" size={14}>
            Kabul edilen cevaplar
          </Txt>
          <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {w.enAccepted.map((a) => {
              const hit = a === result.matched;
              return (
                <div key={a} className={`answer-chip row ${hit ? 'card-on' : 'card'}`}>
                  {hit && <Icon name="check" size={18} color={C.onAccent} strokeWidth={3} />}
                  <Txt variant={hit ? 'bold' : 'medium'} size={18} color={hit ? C.onAccent : C.text}>
                    {a}
                  </Txt>
                </div>
              );
            })}
          </div>
          <Txt size={15} color={result.ok ? C.textMuted : C.danger}>
            {result.ok
              ? `${voice ? 'Duyulan' : 'Yazdığın'}: ${result.heard}`
              : `Yanlış${result.heard ? ` — ${voice ? 'duyulan' : 'yazdığın'}: ${result.heard}` : ''}`}
          </Txt>
        </div>
      )}

      <Spacer />

      <div className="col" style={{ gap: 4 }}>
        {result && <PrimaryButton title={idx + 1 >= words.length ? 'Bitir' : 'Devam'} onPress={next} hint="Enter" />}
        {!result && <LinkButton title="Atla" onPress={next} />}
      </div>
    </Screen>
  );
}
