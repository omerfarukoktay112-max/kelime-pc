// Metin olarak alınıp JSON.parse edilir: büyük veride JS nesnesi olarak gömmekten çok daha hızlı yüklenir
import raw from '@/generated/words.json?raw';
import { LEVELS, type Level, type Word } from './types';

type Row = [number, string, string, string[], string[], number[], string?];

/**
 * Kelimeler build sırasında hazırlanır (scripts/compile-words.mjs); burada sadece nesneye çevrilir.
 * 5.600 kelime birkaç milisaniyede hazır.
 */
function load(rows: Row[]): Word[] {
  const words = new Array<Word>(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const [li, en, tr, trAccepted, enAlt, ck, note] = rows[i];
    words[i] = {
      id: en.toLowerCase(),
      index: i,
      level: LEVELS[li],
      en,
      tr,
      enAccepted: enAlt.length ? [en, ...enAlt] : [en],
      trAccepted,
      ck,
      note,
      search: `${en} ${trAccepted.join(' ')}`.toLocaleLowerCase('tr'),
    };
  }
  return words;
}

const ALL_WORDS = load((JSON.parse(raw) as { words: Row[] }).words);

const BY_LEVEL = {} as Record<Level, Word[]>;
for (const l of LEVELS) BY_LEVEL[l] = [];
for (const w of ALL_WORDS) BY_LEVEL[w.level].push(w);

const BY_ID = new Map(ALL_WORDS.map((w) => [w.id, w]));

export function getAllWords(): readonly Word[] {
  return ALL_WORDS;
}

export function getWordsByLevel(level: Level): readonly Word[] {
  return BY_LEVEL[level];
}

export function getWord(id: string): Word | undefined {
  return BY_ID.get(id);
}

/**
 * İki kelime aynı soruda / eşleştirme tahtasında yan yana olmamalı mı?
 * Aynı anlam grubundaysa ya da Türkçe anlamlarından biri ortaksa birbirinin yerine geçebilirler.
 */
export function conflicts(a: Word, b: Word): boolean {
  if (a === b) return true;
  const x = a.ck;
  const y = b.ck;
  for (let i = 0; i < x.length; i++) for (let j = 0; j < y.length; j++) if (x[i] === y[j]) return true;
  return false;
}
