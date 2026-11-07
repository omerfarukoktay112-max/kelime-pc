import { isDue, isLearned, isMistake } from '@/core/srs';
import { LEVELS, type Level } from '@/core/types';
import { getAllWords, getWord, getWordsByLevel } from '@/core/words';
import { initBackend, localBackend, type Backend, type Op } from '@/platform/backend';
import {
  __resetForTests,
  deckSize,
  deckWords,
  exportBackupJson,
  getSnapshot,
  getStat,
  hydrate,
  importBackupJson,
  isPassive,
  loadFromBackend,
  recordAnswer,
  resetProgress,
  togglePassive,
  updateSettings,
} from '@/store/store';

const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

/** Sayaçların kaba kuvvetle hesaplanmış doğru değerleri */
function bruteCounts() {
  const now = Date.now();
  const active = getAllWords().filter((w) => !isPassive(w.id));
  const learned = Object.fromEntries(
    LEVELS.map((l) => [l, getWordsByLevel(l).filter((w) => isLearned(getStat(w.id))).length]),
  ) as Record<Level, number>;
  return {
    review: active.filter((w) => isDue(getStat(w.id), now)).length,
    mistakes: active.filter((w) => isMistake(getStat(w.id))).length,
    learned,
  };
}

function expectCountsConsistent() {
  const s = getSnapshot();
  const b = bruteCounts();
  expect(s.reviewCount).toBe(b.review);
  expect(s.mistakeCount).toBe(b.mistakes);
  expect(s.learned).toEqual(b.learned);
}

let backend: Backend;
let applied: Op[][];

beforeEach(async () => {
  localStorage.clear();
  __resetForTests();
  applied = [];
  const inner = localBackend(localStorage);
  backend = { ...inner, apply: async (ops) => (applied.push(ops), inner.apply(ops)) };
  await initBackend(backend);
  await loadFromBackend();
});

describe('store', () => {
  it('boş başlangıç', () => {
    const s = getSnapshot();
    expect(s.ready).toBe(true);
    expect(s.reviewCount).toBe(0);
    expect(deckSize('A1')).toBe(getWordsByLevel('A1').length);
  });

  it('artımlı sayaçlar her adımda kaba kuvvet hesabıyla aynı', () => {
    const words = getAllWords();
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    vi.useFakeTimers({ toFake: ['Date'] });
    let t = new Date(2026, 2, 1, 10).getTime();
    try {
      for (let i = 0; i < 1500; i++) {
        vi.setSystemTime(t);
        const w = words[Math.floor(rnd() * 200)];
        const r = rnd();
        if (r < 0.1) togglePassive(w.id);
        else recordAnswer(w.id, r < 0.75);
        if (i % 100 === 99) {
          // birkaç gün ilerle: gece yarısı yeniden hesap (pencere öne gelince de yapılır)
          t += 2 * 86_400_000;
          vi.setSystemTime(t);
          hydrate(JSON.parse(localStorage.getItem('kelime/pc/v1') ?? 'null') ?? { stats: [], passive: [], kv: {} });
        }
        if (i % 50 === 0) expectCountsConsistent();
      }
      expectCountsConsistent();
    } finally {
      vi.useRealTimers();
    }
  });

  it('bir cevap tek işlem olarak kaydedilir, aynı anda gelenler birleşir', async () => {
    recordAnswer('house', true);
    recordAnswer('dog', false);
    await flushMicrotasks();
    expect(applied).toHaveLength(1);
    const ops = applied[0];
    expect(ops.filter((o) => o.op === 'stat').map((o) => (o as { id: string }).id)).toEqual(['house', 'dog']);
    expect(ops.some((o) => o.op === 'kv' && o.key === 'daily')).toBe(true);
  });

  it('kayıt yeniden yüklenince aynı durum gelir', async () => {
    recordAnswer('house', true);
    togglePassive('dog');
    updateSettings({ theme: 'light', dailyGoal: 10 });
    await flushMicrotasks();
    const before = { review: getSnapshot().reviewCount, today: getSnapshot().daily };
    __resetForTests();
    await loadFromBackend();
    expect(getStat('house')?.s).toBe(1);
    expect(isPassive('dog')).toBe(true);
    expect(getSnapshot().settings.theme).toBe('light');
    expect(getSnapshot().settings.dailyGoal).toBe(10);
    expect(getSnapshot().daily).toEqual(before.today);
    expect(getSnapshot().reviewCount).toBe(before.review);
  });

  it('günlük hedef tamamlanınca ağaç bir gün büyür (günde bir kez)', () => {
    updateSettings({ dailyGoal: 10 });
    const ids = getWordsByLevel('A2').slice(0, 15).map((w) => w.id);
    ids.forEach((id) => recordAnswer(id, true));
    expect(getSnapshot().garden.days).toBe(1);
    expect(getSnapshot().daily.count).toBe(15);
  });

  it('tekrar ve hata desteleri, pasif kelimeler hariç', () => {
    recordAnswer('house', false);
    recordAnswer('dog', false);
    recordAnswer('cat', true);
    expect(deckWords('mistakes').map((w) => w.id).sort()).toEqual(['dog', 'house']);
    expect(deckWords('review').map((w) => w.id).sort()).toEqual(['dog', 'house']);
    togglePassive('dog');
    expect(deckWords('mistakes').map((w) => w.id)).toEqual(['house']);
    expect(getSnapshot().mistakeCount).toBe(1);
    expect(deckSize(getWord('dog')!.level)).toBe(getWordsByLevel(getWord('dog')!.level).length - 1);
  });

  it('sıfırlama ilerlemeyi siler, pasifler ve ayarlar kalır', () => {
    recordAnswer('house', false);
    togglePassive('dog');
    updateSettings({ sfx: false });
    resetProgress();
    expect(getStat('house')).toBeUndefined();
    expect(isPassive('dog')).toBe(true);
    expect(getSnapshot().settings.sfx).toBe(false);
    expect(getSnapshot().mistakeCount).toBe(0);
  });

  it('telefon yedeği yüklenir (mobil biçim)', async () => {
    const now = Date.now();
    const mobile = {
      app: 'kelime',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        stats: { house: { c: 3, w: 0, s: 4, t: now, d: now + 86_400_000 }, dog: { c: 0, w: 2, s: 0, t: now, d: now }, bad: { c: 'x' } },
        passive: { cat: true },
        settings: { dailyGoal: 30, haptics: true, theme: 'light', fontSize: 'large' },
        daily: { date: '2026-01-01', count: 4 },
        garden: { days: 9, last: '2026-01-01' },
        lastLevel: 'B2',
      },
    };
    importBackupJson(JSON.stringify(mobile));
    expect(getStat('house')?.s).toBe(4);
    expect(getStat('bad')).toBeUndefined();
    expect(isPassive('cat')).toBe(true);
    const s = getSnapshot();
    expect(s.settings.dailyGoal).toBe(30);
    expect(s.settings.closeToTray).toBe(true);
    expect('haptics' in s.settings).toBe(false);
    expect(s.garden.days).toBe(9);
    expect(s.lastLevel).toBe('B2');
    expect(s.mistakeCount).toBe(1);
    expect(s.learned[getWord('house')!.level]).toBe(1);
    expectCountsConsistent();

    // kalıcı mı?
    await flushMicrotasks();
    __resetForTests();
    await loadFromBackend();
    expect(getStat('house')?.s).toBe(4);
    expect(getSnapshot().garden.days).toBe(9);
  });

  it('dışa aktar -> içe aktar aynı veriyi verir', () => {
    recordAnswer('house', true);
    recordAnswer('dog', false);
    togglePassive('cat');
    const json = exportBackupJson();
    const parsed = JSON.parse(json);
    expect(parsed.app).toBe('kelime');
    expect(parsed.data.stats.house.s).toBe(1);
    expect(parsed.data.passive).toEqual({ cat: true });
    resetProgress();
    importBackupJson(json);
    expect(getStat('house')?.s).toBe(1);
    expect(getStat('dog')?.w).toBe(1);
  });

  it('geçersiz yedek reddedilir', () => {
    expect(() => importBackupJson('nope')).toThrow(/okunamadı/);
    expect(() => importBackupJson('{"app":"other","data":{}}')).toThrow(/yedeği değil/);
  });
});
