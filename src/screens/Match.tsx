import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '@/components/Icon';
import { C, Txt } from '@/components/Txt';
import { Screen, Spacer, StudyHeader } from '@/components/ui';
import { buildMatchBoards, MATCH_BOARD_SIZE, shuffle } from '@/core/session';
import { isLevel, type Deck, type Word } from '@/core/types';
import { answerFeedback } from '@/lib/sfx';
import { speakEnglish, stopSpeaking } from '@/lib/speech';
import { deckWords, getStat, nav, recordAnswer, useStore } from '@/store/store';

type Side = 'en' | 'tr';

/** 4 · Eşleştirme — her tur en fazla 8 kelime */
export function Match({ deck, rounds }: { deck: Deck; rounds: number }) {
  const settings = useStore((s) => s.settings);

  const [boards] = useState<Word[][]>(() => {
    const pool = deckWords(deck);
    // Tekrar / hatalar destesinde aynı kelimeler tekrar tekrar gelmesin
    const n = isLevel(deck) ? rounds : Math.min(rounds, Math.ceil(pool.length / MATCH_BOARD_SIZE));
    return buildMatchBoards(pool, n, getStat);
  });
  const [boardIdx, setBoardIdx] = useState(0);
  const [selected, setSelected] = useState<{ side: Side; id: string } | null>(null);
  const [matched, setMatched] = useState<Set<string>>(() => new Set());
  const [wrongPair, setWrongPair] = useState<{ en: string; tr: string } | null>(null);
  /** Bu turda en az bir kez yanlış eşleştirilen kelimeler (ilk denemede doğru sayılmaz) */
  const missed = useRef<Set<string>>(new Set());
  const firstTryCorrect = useRef(0);
  const totalWords = useRef(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const board = boards[boardIdx] ?? [];
  const left = useMemo(() => shuffle(board), [board]);
  const right = useMemo(() => shuffle(board), [board]);

  useEffect(() => {
    if (!wrongPair) return;
    const t = setTimeout(() => setWrongPair(null), 600);
    return () => clearTimeout(t);
  }, [wrongPair]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      stopSpeaking();
    },
    [],
  );

  if (boards.length === 0) {
    return (
      <Screen>
        <StudyHeader current={0} total={0} />
        <Txt style={{ marginTop: 40 }}>Eşleştirme için en az 2 aktif kelime gerekiyor.</Txt>
      </Screen>
    );
  }

  const finishBoard = (nextMatched: Set<string>) => {
    if (nextMatched.size < board.length) return;
    totalWords.current += board.length;
    advanceTimer.current = setTimeout(() => {
      if (boardIdx + 1 >= boards.length) {
        nav.replace({ name: 'result', deck, rounds, mode: 'match', correct: firstTryCorrect.current, total: totalWords.current });
        return;
      }
      setBoardIdx((i) => i + 1);
      setMatched(new Set());
      setSelected(null);
      missed.current = new Set();
    }, 400);
  };

  const tap = (side: Side, id: string) => {
    if (matched.has(id) || wrongPair) return;
    if (side === 'en' && settings.autoplay) {
      const w = board.find((x) => x.id === id);
      if (w) speakEnglish(w.en, settings);
    }
    if (!selected || selected.side === side) {
      setSelected(selected?.id === id && selected.side === side ? null : { side, id });
      return;
    }
    const enId = side === 'en' ? id : selected.id;
    const trId = side === 'tr' ? id : selected.id;
    setSelected(null);

    if (enId === trId) {
      const firstTry = !missed.current.has(enId);
      if (firstTry) firstTryCorrect.current += 1;
      recordAnswer(enId, firstTry);
      answerFeedback(true, settings);
      const next = new Set(matched).add(enId);
      setMatched(next);
      finishBoard(next);
    } else {
      missed.current.add(enId);
      answerFeedback(false, settings);
      setWrongPair({ en: enId, tr: trId });
    }
  };

  const cell = (side: Side, w: Word) => {
    const isMatched = matched.has(w.id);
    const isSelected = selected?.side === side && selected.id === w.id;
    const isWrong = wrongPair?.[side] === w.id;
    const label = side === 'en' ? w.en : w.tr;
    const cls = isMatched ? 'cell-matched' : isSelected ? 'cell-selected' : isWrong ? 'cell-wrong' : 'cell-default';
    return (
      <button
        key={`${side}-${w.id}`}
        type="button"
        aria-pressed={isSelected}
        disabled={isMatched}
        onClick={() => tap(side, w.id)}
        className={`cell row press ${cls}`}
        title={label}
      >
        <Txt
          variant={isSelected ? 'bold' : 'medium'}
          size={label.length > 18 ? 14 : 17}
          color={isMatched ? C.textDisabled : isSelected ? C.onAccent : C.text}
          className="ellipsis"
          style={{ flex: 1 }}
        >
          {label}
        </Txt>
        {isMatched && <Icon name="check" size={18} color={C.accent} strokeWidth={3} />}
      </button>
    );
  };

  return (
    <Screen style={{ paddingBottom: 24 }}>
      <StudyHeader current={boardIdx + 1} total={boards.length} />
      <Txt variant="display" size={32} style={{ marginTop: 24 }}>
        Eşleştir
      </Txt>

      <div className="row" style={{ marginTop: 24, gap: 12, alignItems: 'flex-start' }}>
        <div className="col" style={{ flex: 1, gap: 8, minWidth: 0 }}>
          {left.map((w) => cell('en', w))}
        </div>
        <div className="col" style={{ flex: 1, gap: 8, minWidth: 0 }}>
          {right.map((w) => cell('tr', w))}
        </div>
      </div>

      <Spacer />
      <Txt variant="medium" size={15} color={C.textMuted} style={{ textAlign: 'center' }}>
        {matched.size} / {board.length} eşleşti
      </Txt>
    </Screen>
  );
}
