import { conflicts, getAllWords, getWordsByLevel } from './words';
import type { Direction, Word } from './types';
import { isDue, type WordStat } from './srs';

export type StatLookup = (id: string) => WordStat | undefined;

export function shuffle<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Havuzu öncelik sırasına dizer:
 * 1) tekrar zamanı gelmiş kelimeler (önce alt kutudakiler, sonra en uzun süredir görülmeyenler)
 * 2) hiç görülmemiş kelimeler (rastgele)
 * 3) zamanı henüz gelmemiş kelimeler (tekrar tarihi en yakın olan önce)
 */
function prioritize(pool: readonly Word[], stat: StatLookup): Word[] {
  const now = Date.now();
  const scored = shuffle(pool).map((w) => {
    const s = stat(w.id);
    const group = !s ? 1 : isDue(s, now) ? 0 : 2;
    const key = !s ? 0 : group === 0 ? s.s * 1e13 + s.t : (s.d ?? 0);
    return { w, group, key };
  });
  scored.sort((a, b) => a.group - b.group || a.key - b.key);
  return scored.map((x) => x.w);
}

/**
 * Çalışılacak kelimeleri seçer. `repeat` açıksa ve havuz küçükse liste tekrar edilir
 * (seviye çalışması); kapalıysa en fazla havuz kadar kelime döner (tekrar / hatalar).
 */
export function pickStudyWords(pool: readonly Word[], count: number, stat: StatLookup, repeat = true): Word[] {
  if (pool.length === 0 || count <= 0) return [];
  const ordered = prioritize(pool, stat);
  if (!repeat) return ordered.slice(0, count);
  const out: Word[] = [];
  while (out.length < count) out.push(...ordered.slice(0, count - out.length));
  return out;
}

export interface ChoiceQuestion {
  word: Word;
  prompt: string;
  options: string[];
  correctIndex: number;
}

/**
 * Havuzdan `need` tane uygun çeldirici seçer. Tüm havuzu karıştırmak yerine rastgele
 * örnekler; çok sayıda ret olursa (küçük ya da çakışmalı havuz) karıştırılmış taramaya döner.
 */
function sampleDistractors(
  pool: readonly Word[],
  need: number,
  accept: (w: Word) => boolean,
  picked: Word[],
): void {
  const n = pool.length;
  if (n === 0) return;
  const tried = new Set<number>();
  const maxTries = Math.min(n, need * 12);
  while (picked.length < need && tried.size < maxTries) {
    const i = Math.floor(Math.random() * n);
    if (tried.has(i)) continue;
    tried.add(i);
    if (accept(pool[i])) picked.push(pool[i]);
  }
  if (picked.length >= need || tried.size >= n) return;
  for (const w of shuffle(pool)) {
    if (picked.length >= need) return;
    if (accept(w)) picked.push(w);
  }
}

/**
 * Çoktan seçmeli soru: 1 doğru + 3 çeldirici. Çeldiriciler önce aynı seviyeden alınır;
 * doğru kelimeyle eş anlamlı / anlamı çakışan kelimeler çeldirici olamaz.
 */
export function buildChoiceQuestion(word: Word, direction: Direction, optionCount = 4): ChoiceQuestion {
  const answerOf = (w: Word) => (direction === 'en-tr' ? w.tr : w.en);
  const correct = answerOf(word);
  const picked: Word[] = [];
  const usedText = new Set([correct.toLocaleLowerCase('tr')]);
  const accept = (w: Word) => {
    const text = answerOf(w).toLocaleLowerCase('tr');
    if (usedText.has(text) || conflicts(word, w) || picked.some((p) => conflicts(p, w))) return false;
    usedText.add(text);
    return true;
  };
  const need = optionCount - 1;
  sampleDistractors(getWordsByLevel(word.level), need, accept, picked);
  if (picked.length < need) sampleDistractors(getAllWords(), need, accept, picked);

  const options = shuffle([correct, ...picked.map(answerOf)]);
  return {
    word,
    prompt: direction === 'en-tr' ? word.en : word.tr,
    options,
    correctIndex: options.indexOf(correct),
  };
}

export const MATCH_BOARD_SIZE = 8;

/**
 * Eşleştirme turları: her tur en fazla 8 kelime. Bir tahtada anlamı çakışan iki kelime
 * olmaz (ör. "very" ve "much" ikisi de "çok" olduğundan aynı tahtaya konmaz).
 */
export function buildMatchBoards(pool: readonly Word[], rounds: number, stat: StatLookup): Word[][] {
  if (pool.length < 2) return [];
  const ordered = prioritize(pool, stat);
  const boards: Word[][] = [];
  let cursor = 0;
  for (let r = 0; r < rounds; r++) {
    const board: Word[] = [];
    for (let tries = 0; tries < ordered.length && board.length < MATCH_BOARD_SIZE; tries++) {
      const w = ordered[(cursor + tries) % ordered.length];
      if (!board.some((b) => conflicts(b, w))) board.push(w);
    }
    cursor = (cursor + MATCH_BOARD_SIZE) % ordered.length;
    if (board.length >= 2) boards.push(board);
  }
  return boards;
}

/**
 * Sesli mod (Windows konuşma tanıma) için tanınacak ifadeler: doğru cevaplar + rastgele
 * birkaç başka kelime. Tanıyıcı yalnızca doğru cevaplarla sınırlansaydı her sesi doğru
 * cevaba benzetirdi; başka kelimeler de listede olunca yanlış söyleyiş yanlış çıkar.
 */
export function speechPhrases(word: Word, extra = 60): string[] {
  const all = getAllWords();
  const out = new Set(word.enAccepted);
  for (let tries = 0; out.size < word.enAccepted.length + extra && tries < extra * 4; tries++) {
    const w = all[Math.floor(Math.random() * all.length)];
    if (!conflicts(word, w)) out.add(w.en);
  }
  return [...out];
}
