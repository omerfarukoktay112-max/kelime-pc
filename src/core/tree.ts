/**
 * Ağaç: günlük hedefini tamamladığın her gün ağaç bir gün büyür.
 * Çalışmadığın günler ağacı küçültmez; dün ve bugün hedefi tamamlamadıysan ağaç sadece "susar" (solgun görünür).
 */
export interface Garden {
  /** günlük hedefin tamamlandığı toplam gün */
  days: number;
  /** hedefin son tamamlandığı gün (YYYY-AA-GG) */
  last: string;
}

export const TREE_STAGES = [
  { from: 0, name: 'Tohum' },
  { from: 1, name: 'Filiz' },
  { from: 3, name: 'Fidan' },
  { from: 7, name: 'Genç ağaç' },
  { from: 14, name: 'Ağaç' },
  { from: 30, name: 'Çiçekli ağaç' },
  { from: 60, name: 'Meyveli ağaç' },
] as const;

export function treeStage(days: number): number {
  let stage = 0;
  TREE_STAGES.forEach((s, i) => {
    if (days >= s.from) stage = i;
  });
  return stage;
}

/** Sonraki aşamaya kaç gün kaldı (son aşamadaysa null). */
export function daysToNextStage(days: number): { days: number; name: string } | null {
  const next = TREE_STAGES[treeStage(days) + 1];
  return next ? { days: next.from - days, name: next.name } : null;
}

export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Bugün ya da dün sulanmadıysa ağaç susamıştır. */
export function isThirsty(garden: Garden): boolean {
  if (garden.days === 0) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return garden.last !== dayKey() && garden.last !== dayKey(yesterday);
}
