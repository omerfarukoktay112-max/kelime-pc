/** Cevap karşılaştırması için metni sadeleştirir: küçük harf, noktalama ve fazla boşluk yok. */
export function normalizeAnswer(text: string): string {
  // Önce boşluklar sadeleşir; yoksa " to run" gibi başta boşluklu cevapta "to" atılamıyordu
  return text
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(to|a|an|the)\s+/, '');
}

/**
 * Konuşma tanımanın döndürdüğü alternatiflerden biri kabul edilen cevaplardan biriyle
 * eşleşiyor mu? Eşleşen kabul edilen cevabı döndürür.
 */
export function matchSpoken(heard: string[], accepted: string[]): string | null {
  const acc = new Map(accepted.map((a) => [normalizeAnswer(a), a]));
  for (const h of heard) {
    const n = normalizeAnswer(h);
    if (acc.has(n)) return acc.get(n)!;
    // "it's a house" gibi cümle içinde geçtiyse de kabul et
    for (const [key, original] of acc) {
      if (key && new RegExp(`(^|\\s)${escapeRegExp(key)}(\\s|$)`).test(n)) return original;
    }
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
