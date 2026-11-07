export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_NAMES: Record<Level, string> = {
  A1: 'Başlangıç',
  A2: 'Temel',
  B1: 'Orta',
  B2: 'Orta üstü',
  C1: 'İleri',
  C2: 'Uzman',
};

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

/** Uygulama içinde kullanılan kelime (scripts/compile-words.mjs çıktısından). */
export interface Word {
  /** Kalıcı kimlik (küçük harfli İngilizce kelime): ilerleme ve pasif listesi bu id ile saklanır. */
  id: string;
  /** Aynı listedeki sırası (0..n-1) */
  index: number;
  level: Level;
  /** İngilizce kelime (ekranda gösterilen). */
  en: string;
  /** Ekranda gösterilen Türkçe karşılık; belirsizse bağlam etiketli: "saat (süre)" */
  tr: string;
  /** Sesli / yazılı modda doğru kabul edilen İngilizce cevaplar (kelimenin kendisi + eş anlamlılar). */
  enAccepted: string[];
  /** Kelimenin tüm Türkçe karşılıkları. */
  trAccepted: string[];
  /** Çakışma anahtarları: ortak anahtarı olan iki kelime birbirinin yerine geçebilir. */
  ck: number[];
  note?: string;
  /** Kelime listesindeki arama için: "house ev konut" (küçük harf) */
  search: string;
}

export type StudyMode = 'choice' | 'match' | 'speak';

/** Soru yönü: İngilizce → Türkçe ya da tersi. */
export type Direction = 'en-tr' | 'tr-en';

/** Çalışma destesi: bir seviye, ya da tüm seviyelerden zamanı gelen tekrarlar / hatalar. */
export type Deck = Level | 'review' | 'mistakes';

export function isDeck(value: unknown): value is Deck {
  return value === 'review' || value === 'mistakes' || isLevel(value);
}

export const DECK_TITLES: Record<'review' | 'mistakes', string> = {
  review: 'Tekrar',
  mistakes: 'Hatalarım',
};

export function deckLabel(deck: Deck): string {
  return isLevel(deck) ? deck : DECK_TITLES[deck];
}
