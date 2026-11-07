import { readFileSync } from 'node:fs';

// @ts-expect-error: .mjs script, tipleri yok
import { compile } from '../scripts/compile-words.mjs';
import { matchSpoken, normalizeAnswer } from '@/core/answer';
import { buildChoiceQuestion, buildMatchBoards, pickStudyWords, speechPhrases } from '@/core/session';
import { isDue, isLearned, isMistake, nextStat, type WordStat } from '@/core/srs';
import { daysToNextStage, treeStage } from '@/core/tree';
import { LEVELS } from '@/core/types';
import { conflicts, getAllWords, getWord, getWordsByLevel } from '@/core/words';

const DAY = 86_400_000;

describe('kelime verisi', () => {
  it('kaynaktaki tüm geçerli kelimeler yüklenir, kimlikler benzersiz', () => {
    const src = JSON.parse(readFileSync('data/words.source.json', 'utf8'));
    const srcCount = LEVELS.reduce((n, l) => n + src[l].length, 0);
    const all = getAllWords();
    expect(all.length).toBeGreaterThan(5500);
    expect(all.length).toBeLessThanOrEqual(srcCount);
    expect(new Set(all.map((w) => w.id)).size).toBe(all.length);
    for (const l of LEVELS) expect(getWordsByLevel(l).length).toBeGreaterThanOrEqual(500);
    all.forEach((w, i) => expect(w.index).toBe(i));
  });

  it('mobil sürümdeki gösterim kuralları korunur', () => {
    // hour / clock: aynı ana anlam, farklı gruplar -> bağlam etiketli
    const hour = getWord('hour')!;
    const clock = getWord('clock')!;
    expect(hour.tr).not.toBe(clock.tr);
    expect(hour.tr).toMatch(/saat/);
    expect(conflicts(hour, clock)).toBe(true);
    // eş anlamlılar sesli modda doğru sayılır
    const withSyn = getAllWords().find((w) => w.enAccepted.length > 1)!;
    const other = getWord(withSyn.enAccepted[1].toLowerCase())!;
    expect(other.enAccepted).toContain(withSyn.en);
  });

  it('geçersiz ve tekrar eden kayıtlar atlanır', () => {
    const { out, skipped } = compile({
      A1: [
        { word: 'house', turkish: ['ev'], meaning_groups: ['ev'] },
        { word: 'House', turkish: ['ev'] },
        { word: '', turkish: ['x'] },
        { word: 'empty', turkish: [] },
      ],
    });
    expect(out.words).toHaveLength(1);
    expect(skipped).toBe(3);
  });
});

describe('aralıklı tekrar', () => {
  it('doğru cevap kutuyu ilerletir, yanlış sıfırlar', () => {
    const now = new Date(2026, 0, 10, 15).getTime();
    const s1 = nextStat(undefined, true, now);
    expect(s1.s).toBe(1);
    expect(isDue(s1, now)).toBe(false);
    expect(isDue(s1, now + DAY)).toBe(true);
    // zamanı gelmeden doğru: sadece pratik
    const s1b = nextStat(s1, true, now + 1000);
    expect(s1b.s).toBe(1);
    expect(s1b.c).toBe(2);
    let s: WordStat = s1;
    for (let i = 0; i < 3; i++) s = nextStat(s, true, (s.d ?? 0) + 1);
    expect(isLearned(s)).toBe(true);
    const wrong = nextStat(s, false, now);
    expect(wrong.s).toBe(0);
    expect(isMistake(wrong)).toBe(true);
    expect(isDue(wrong, now)).toBe(true);
  });

  it('ağaç aşamaları', () => {
    expect(treeStage(0)).toBe(0);
    expect(treeStage(7)).toBe(3);
    expect(treeStage(100)).toBe(6);
    expect(daysToNextStage(2)).toEqual({ days: 1, name: 'Fidan' });
    expect(daysToNextStage(60)).toBeNull();
  });
});

describe('oturum', () => {
  it('çoktan seçmeli: 4 farklı seçenek, çakışan çeldirici yok', () => {
    for (const w of getAllWords().filter((_, i) => i % 37 === 0)) {
      for (const dir of ['en-tr', 'tr-en'] as const) {
        const q = buildChoiceQuestion(w, dir);
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options.map((o) => o.toLocaleLowerCase('tr'))).size).toBe(4);
        expect(q.options[q.correctIndex]).toBe(dir === 'en-tr' ? w.tr : w.en);
        const answerOf = (x: typeof w) => (dir === 'en-tr' ? x.tr : x.en);
        const distractors = q.options.filter((_, i) => i !== q.correctIndex);
        for (const d of distractors) {
          const dw = getAllWords().filter((x) => answerOf(x) === d);
          // en az bir kelimeye ait ve hiçbiri doğru kelimeyle çakışmıyor olmalı
          expect(dw.some((x) => !conflicts(w, x))).toBe(true);
        }
      }
    }
  });

  it('öncelik: zamanı gelen > hiç görülmemiş > zamanı gelmemiş', () => {
    const pool = getWordsByLevel('A1').slice(0, 30);
    const now = Date.now();
    const stats: Record<string, WordStat> = {
      [pool[5].id]: { c: 1, w: 1, s: 0, t: now - 5000, d: now - 5000 },
      [pool[6].id]: { c: 1, w: 0, s: 1, t: now, d: now + 3 * DAY },
    };
    const picked = pickStudyWords(pool, 30, (id) => stats[id], false);
    expect(picked[0].id).toBe(pool[5].id);
    expect(picked[picked.length - 1].id).toBe(pool[6].id);
    // repeat: küçük havuz tekrar edilir
    expect(pickStudyWords(pool.slice(0, 3), 10, () => undefined, true)).toHaveLength(10);
  });

  it('eşleştirme tahtalarında çakışan kelime yok', () => {
    const boards = buildMatchBoards(getWordsByLevel('A1'), 20, () => undefined);
    expect(boards).toHaveLength(20);
    for (const b of boards) {
      expect(b.length).toBe(8);
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) expect(conflicts(b[i], b[j])).toBe(false);
    }
  });

  it('sesli mod ifadeleri doğru cevapları içerir', () => {
    const w = getWord('house')!;
    const p = speechPhrases(w);
    for (const a of w.enAccepted) expect(p).toContain(a);
    expect(p.length).toBeGreaterThan(30);
  });

  it('cevap karşılaştırma', () => {
    expect(normalizeAnswer('  To Run! ')).toBe('run');
    expect(matchSpoken(["it's a house"], ['house'])).toBe('house');
    expect(matchSpoken(['horse'], ['house'])).toBeNull();
  });
});
