/**
 * Aralıklı tekrar (spaced repetition) kuralları.
 *
 * - Her kelimenin bir "kutu"su var (`s`): art arda kaç kez zamanında doğru bilindiği.
 * - Doğru cevap kutuyu bir artırır ve kelimeyi ileri bir güne erteler (INTERVAL_DAYS).
 * - Kelime zamanı gelmeden doğru bilinirse sadece pratik sayılır: kutu ve tarih değişmez.
 * - Yanlış cevap kutuyu sıfırlar; kelime hemen tekrar listesine ve "Hatalarım"a düşer.
 * - 4. kutuya ulaşan kelime "öğrenildi" sayılır ama kaybolmaz; seyrek aralıklarla tekrar sorulur.
 */

/** Bu kadar kez zamanında doğru bilinen kelime "öğrenildi" sayılır (ilk görüş, +1, +3, +7 gün). */
export const LEARNED_STREAK = 4;

/** Kutu numarasına göre bir sonraki tekrara kadar geçecek gün. */
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60];

export interface WordStat {
  /** toplam doğru */
  c: number;
  /** toplam yanlış */
  w: number;
  /** kutu: art arda zamanında doğru */
  s: number;
  /** son görülme (ms) */
  t: number;
  /** bir sonraki tekrar zamanı (ms). Yoksa hemen tekrar edilebilir. */
  d?: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** `days` gün sonrasının gece yarısı (yerel saat). Tekrarlar saatine değil gününe göre gelir. */
function startOfDayPlus(now: number, days: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + days * DAY;
}

export function isLearned(stat: WordStat | undefined): boolean {
  return !!stat && stat.s >= LEARNED_STREAK;
}

/** Görülmüş ve tekrar zamanı gelmiş mi? (hiç görülmemiş kelime tekrar sayılmaz) */
export function isDue(stat: WordStat | undefined, now = Date.now()): boolean {
  return !!stat && (stat.d ?? 0) <= now;
}

/** "Hatalarım": son cevabı yanlış olan kelimeler. Bir kez doğru bilince listeden çıkar. */
export function isMistake(stat: WordStat | undefined): boolean {
  return !!stat && stat.w > 0 && stat.s === 0;
}

export function nextStat(old: WordStat | undefined, correct: boolean, now = Date.now()): WordStat {
  const prev = old ?? { c: 0, w: 0, s: 0, t: 0 };
  if (!correct) return { c: prev.c, w: prev.w + 1, s: 0, t: now, d: now };
  // Hiç görülmemiş ya da zamanı gelmişse kutu ilerler
  if (!old || isDue(old, now)) {
    const s = prev.s + 1;
    const days = INTERVAL_DAYS[Math.min(s, INTERVAL_DAYS.length - 1)];
    return { c: prev.c + 1, w: prev.w, s, t: now, d: startOfDayPlus(now, days) };
  }
  return { ...prev, c: prev.c + 1, t: now };
}
