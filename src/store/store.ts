/**
 * Uygulama durumu. Mobil sürümdeki tek büyük React Context yerine:
 *
 * - İlerleme (stats) ve pasif kelimeler değiştirilebilir Map/Set'lerde durur. Bir cevap yalnızca
 *   o kelimeyi değiştirir; 5.600 kelimelik nesne kopyalanmaz.
 * - Tekrar / hata / öğrenilen sayıları her değişiklikte baştan hesaplanmaz, ±1 güncellenir.
 *   Zaman geçtikçe değişen tek şey "tekrar zamanı geldi mi"; tekrar tarihleri hep gece yarısına
 *   denk geldiği için gece yarısında bir kez yeniden hesaplamak yeterli (sürekli kontrol yok).
 * - Bileşenler `useStore(seçici)` ile yalnızca ihtiyaç duydukları değere abone olur; ilgisiz bir
 *   değişiklik onları yeniden çizdirmez.
 * - Kayıt: değişiklikler aynı anda biriktirilip tek işlemde SQLite'a yazılır.
 */
import { useSyncExternalStore } from 'react';

import { isDue, isLearned, isMistake, nextStat, type WordStat } from '@/core/srs';
import { dayKey, type Garden } from '@/core/tree';
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings';
import { isLevel, LEVELS, type Deck, type Level, type StudyMode, type Word } from '@/core/types';
import { getAllWords, getWord, getWordsByLevel } from '@/core/words';
import { getBackend, type Loaded, type Op } from '@/platform/backend';

export { LEARNED_STREAK, isLearned, type WordStat } from '@/core/srs';

// ---------- Rotalar ----------

export type Route =
  | { name: 'home' }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'setup'; deck: Deck }
  | { name: 'words'; level: Level }
  | { name: 'quiz' | 'match' | 'speak'; deck: Deck; rounds: number }
  | { name: 'result'; deck: Deck; rounds: number; mode: StudyMode; correct: number; total: number };

export type Keyed<R extends Route = Route> = R & { key: number };

export interface Dialog {
  title: string;
  message: string;
  confirm?: string;
  danger?: boolean;
  onConfirm?: () => void;
}

interface Daily {
  date: string;
  count: number;
}

export interface Snapshot {
  ready: boolean;
  settings: Settings;
  daily: Daily;
  garden: Garden;
  lastLevel: Level;
  stack: Keyed[];
  /** Tüm seviyelerde tekrar zamanı gelmiş aktif kelime sayısı */
  reviewCount: number;
  /** "Hatalarım"daki aktif kelime sayısı */
  mistakeCount: number;
  /** Seviye başına öğrenilen kelime (pasifler dahil) */
  learned: Record<Level, number>;
  /** stats her değiştiğinde artar */
  statsVersion: number;
  /** pasif listesi her değiştiğinde artar */
  passiveVersion: number;
  /** Sayıların hesaplandığı gün */
  today: string;
  dialog: Dialog | null;
  toast: string | null;
}

const zeroLevels = () => Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>;

let routeKey = 0;
const keyed = (r: Route): Keyed => ({ ...r, key: ++routeKey });

let snap: Snapshot = {
  ready: false,
  settings: DEFAULT_SETTINGS,
  daily: { date: '', count: 0 },
  garden: { days: 0, last: '' },
  lastLevel: 'A1',
  stack: [keyed({ name: 'home' })],
  reviewCount: 0,
  mistakeCount: 0,
  learned: zeroLevels(),
  statsVersion: 0,
  passiveVersion: 0,
  today: dayKey(),
  dialog: null,
  toast: null,
};

const stats = new Map<string, WordStat>();
const passive = new Set<string>();
const listeners = new Set<() => void>();

function set(patch: Partial<Snapshot>) {
  snap = { ...snap, ...patch };
  for (const l of listeners) l();
}

export function getSnapshot(): Snapshot {
  return snap;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Seçici ilkel bir değer ya da durumdaki hazır bir nesneyi döndürmeli (her çağrıda yeni nesne değil). */
export function useStore<T>(selector: (s: Snapshot) => T): T {
  return useSyncExternalStore(subscribe, () => selector(snap));
}

export const getStat = (id: string): WordStat | undefined => stats.get(id);
export const isPassive = (id: string): boolean => passive.has(id);

// ---------- Kayıt kuyruğu ----------

let pending: Op[] = [];
let flushQueued = false;

function persist(...ops: Op[]) {
  pending.push(...ops);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(flush);
}

function flush() {
  flushQueued = false;
  if (pending.length === 0) return;
  const ops = pending;
  pending = [];
  getBackend()
    .apply(ops)
    .catch((e) => {
      console.warn('[store] kaydedilemedi, yeniden denenecek', e);
      pending = [...ops, ...pending];
      setTimeout(() => {
        if (!flushQueued) {
          flushQueued = true;
          queueMicrotask(flush);
        }
      }, 2000);
    });
}

const kv = (key: string, value: unknown): Op => ({ op: 'kv', key, value: JSON.stringify(value) });
const statOp = (id: string, s: WordStat): Op => ({ op: 'stat', id, c: s.c, w: s.w, s: s.s, t: s.t, d: s.d });

// ---------- Sayaçlar ----------

const DUE = 1;
const MISTAKE = 2;
const LEARNED = 4;

function flagsOf(id: string, now: number): number {
  const s = stats.get(id);
  if (!s) return 0;
  const active = !passive.has(id);
  return (active && isDue(s, now) ? DUE : 0) | (active && isMistake(s) ? MISTAKE : 0) | (isLearned(s) ? LEARNED : 0);
}

/** Tüm sayaçları baştan hesaplar: açılışta, gece yarısı ve yedek yüklenince. Sadece görülmüş kelimeler gezilir. */
function recountAll(): Pick<Snapshot, 'reviewCount' | 'mistakeCount' | 'learned' | 'today'> {
  const now = Date.now();
  let reviewCount = 0;
  let mistakeCount = 0;
  const learned = zeroLevels();
  for (const id of stats.keys()) {
    const w = getWord(id);
    if (!w) continue;
    const f = flagsOf(id, now);
    if (f & DUE) reviewCount++;
    if (f & MISTAKE) mistakeCount++;
    if (f & LEARNED) learned[w.level]++;
  }
  return { reviewCount, mistakeCount, learned, today: dayKey() };
}

/** Bir kelimeyi değiştiren işlemi çalıştırır, sayaçları farka göre günceller. */
function mutateWord(id: string, change: () => void): Partial<Snapshot> {
  const w = getWord(id);
  const now = Date.now();
  const before = flagsOf(id, now);
  change();
  const after = flagsOf(id, now);
  const delta = (bit: number) => ((after & bit ? 1 : 0) - (before & bit ? 1 : 0));
  const patch: Partial<Snapshot> = {};
  if (delta(DUE)) patch.reviewCount = snap.reviewCount + delta(DUE);
  if (delta(MISTAKE)) patch.mistakeCount = snap.mistakeCount + delta(MISTAKE);
  if (w && delta(LEARNED)) patch.learned = { ...snap.learned, [w.level]: snap.learned[w.level] + delta(LEARNED) };
  return patch;
}

let midnightTimer: ReturnType<typeof setTimeout> | null = null;

/** Gece yarısında bir kez çalışan zamanlayıcı (tekrar zamanı gelen kelimeler o anda değişir). */
function scheduleMidnight() {
  if (midnightTimer) clearTimeout(midnightTimer);
  const next = new Date();
  next.setHours(24, 0, 1, 0);
  midnightTimer = setTimeout(() => {
    set(recountAll());
    scheduleMidnight();
  }, next.getTime() - Date.now());
}

/** Bilgisayar uykudan uyanınca zamanlayıcı gecikmiş olabilir; pencere öne gelince gün değiştiyse yenile. */
export function refreshIfDayChanged() {
  if (snap.ready && snap.today !== dayKey()) {
    set(recountAll());
    scheduleMidnight();
  }
}

// ---------- Doğrulama (kayıttan ve yedekten gelen veri) ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function cleanStat(s: unknown): WordStat | null {
  if (!isObj(s) || !isNum(s.c) || !isNum(s.w) || !isNum(s.s) || !isNum(s.t)) return null;
  return { c: s.c, w: s.w, s: s.s, t: s.t, ...(isNum(s.d) ? { d: s.d } : {}) };
}

function cleanSettings(v: unknown): Settings {
  const settings = { ...DEFAULT_SETTINGS };
  if (isObj(v)) {
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      if (typeof v[key] === typeof DEFAULT_SETTINGS[key]) (settings as Record<string, unknown>)[key] = v[key];
    }
  }
  return settings;
}

const cleanDaily = (v: unknown): Daily =>
  isObj(v) && typeof v.date === 'string' && isNum(v.count) ? { date: v.date, count: v.count } : { date: '', count: 0 };

const cleanGarden = (v: unknown): Garden =>
  isObj(v) && isNum(v.days) && typeof v.last === 'string' ? { days: v.days, last: v.last } : { days: 0, last: '' };

function parseKv(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// ---------- Yükleme ----------

export function hydrate(data: Loaded) {
  stats.clear();
  passive.clear();
  for (const [id, c, w, s, t, d] of data.stats) {
    const st = cleanStat({ c, w, s, t, d: d ?? undefined });
    if (st) stats.set(id, st);
  }
  for (const id of data.passive) passive.add(id);
  const lastLevel = parseKv(data.kv.lastLevel);
  set({
    ready: true,
    settings: cleanSettings(parseKv(data.kv.settings)),
    daily: cleanDaily(parseKv(data.kv.daily)),
    garden: cleanGarden(parseKv(data.kv.garden)),
    lastLevel: isLevel(lastLevel) ? lastLevel : 'A1',
    statsVersion: snap.statsVersion + 1,
    passiveVersion: snap.passiveVersion + 1,
    ...recountAll(),
  });
  scheduleMidnight();
}

export async function loadFromBackend() {
  try {
    hydrate(await getBackend().load());
  } catch (e) {
    console.warn('[store] yüklenemedi', e);
    hydrate({ stats: [], passive: [], kv: {} });
  }
}

// ---------- İşlemler ----------

export function todayCount(s: Snapshot = snap): number {
  return s.daily.date === dayKey() ? s.daily.count : 0;
}

export function recordAnswer(wordId: string, correct: boolean) {
  const d = dayKey();
  const daily = snap.daily.date === d ? snap.daily : { date: d, count: 0 };
  const nextDaily = correct ? { date: d, count: daily.count + 1 } : daily;
  // Günlük hedef bugün ilk kez tamamlandıysa ağaç bir gün büyür
  const garden =
    nextDaily.count >= snap.settings.dailyGoal && snap.garden.last !== d
      ? { days: snap.garden.days + 1, last: d }
      : snap.garden;

  let stat!: WordStat;
  const patch = mutateWord(wordId, () => {
    stat = nextStat(stats.get(wordId), correct);
    stats.set(wordId, stat);
  });
  const ops: Op[] = [statOp(wordId, stat)];
  if (nextDaily !== snap.daily) ops.push(kv('daily', nextDaily));
  if (garden !== snap.garden) ops.push(kv('garden', garden));
  persist(...ops);
  set({ ...patch, daily: nextDaily, garden, statsVersion: snap.statsVersion + 1 });
}

export function togglePassive(wordId: string) {
  let on = false;
  const patch = mutateWord(wordId, () => {
    on = !passive.has(wordId);
    if (on) passive.add(wordId);
    else passive.delete(wordId);
  });
  persist({ op: 'passive', id: wordId, on });
  set({ ...patch, passiveVersion: snap.passiveVersion + 1 });
}

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...snap.settings, ...patch };
  persist(kv('settings', settings));
  set({ settings });
}

export function setLastLevel(lastLevel: Level) {
  if (snap.lastLevel === lastLevel) return;
  persist(kv('lastLevel', lastLevel));
  set({ lastLevel });
}

export function resetProgress() {
  stats.clear();
  const daily = { date: dayKey(), count: 0 };
  const garden = { days: 0, last: '' };
  persist({ op: 'clearStats' }, kv('daily', daily), kv('garden', garden));
  set({ daily, garden, statsVersion: snap.statsVersion + 1, ...recountAll() });
}

/** Destedeki aktif (pasif olmayan) kelimeler. Çalışma başlarken bir kez çağrılır. */
export function deckWords(deck: Deck): Word[] {
  const now = Date.now();
  if (deck === 'review' || deck === 'mistakes') {
    const out: Word[] = [];
    for (const [id, s] of stats) {
      if (passive.has(id)) continue;
      const w = getWord(id);
      if (w && (deck === 'review' ? isDue(s, now) : isMistake(s))) out.push(w);
    }
    // Kelime listesindeki sırayla (seviye sırası), mobil sürümle aynı
    return out.sort((a, b) => a.index - b.index);
  }
  return getWordsByLevel(deck).filter((w) => !passive.has(w.id));
}

export function deckSize(deck: Deck, s: Snapshot = snap): number {
  if (deck === 'review') return s.reviewCount;
  if (deck === 'mistakes') return s.mistakeCount;
  let n = 0;
  for (const w of getWordsByLevel(deck)) if (!passive.has(w.id)) n++;
  return n;
}

export const levelTotal = (level: Level) => getWordsByLevel(level).length;
export const totalWords = () => getAllWords().length;

// ---------- Yedek (mobil uygulamayla aynı biçim) ----------

const BACKUP_APP = 'kelime';
const BACKUP_VERSION = 1;

export function exportBackupJson(): string {
  const data = {
    stats: Object.fromEntries(stats),
    passive: Object.fromEntries([...passive].map((id) => [id, true])),
    settings: snap.settings,
    daily: snap.daily,
    garden: snap.garden,
    lastLevel: snap.lastLevel,
  };
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data });
}

/** Yedeği yükler; geçersizse hata fırlatır. Telefonda alınan yedek de olabilir. */
export function importBackupJson(json: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Dosya okunamadı. Kelime yedek dosyası seçtiğinden emin ol.');
  }
  if (!isObj(parsed) || parsed.app !== BACKUP_APP || !isObj(parsed.data)) {
    throw new Error('Bu dosya bir Kelime yedeği değil.');
  }
  const src = parsed.data;
  const statRows: Loaded['stats'] = [];
  if (isObj(src.stats)) {
    for (const [id, s] of Object.entries(src.stats)) {
      const st = cleanStat(s);
      if (st) statRows.push([id, st.c, st.w, st.s, st.t, st.d ?? null]);
    }
  }
  const passiveIds = isObj(src.passive) ? Object.keys(src.passive) : [];
  // Telefondan gelen yedekte PC'ye özel ayar yok; şu anki değer korunur
  const settings = cleanSettings({ closeToTray: snap.settings.closeToTray, ...(isObj(src.settings) ? src.settings : {}) });
  const lastLevel = isLevel(src.lastLevel) ? src.lastLevel : 'A1';
  const kvs = {
    settings: JSON.stringify(settings),
    daily: JSON.stringify(cleanDaily(src.daily)),
    garden: JSON.stringify(cleanGarden(src.garden)),
    lastLevel: JSON.stringify(lastLevel),
  };

  persist(
    { op: 'clearAll' },
    ...statRows.map(([id, c, w, s, t, d]): Op => ({ op: 'stat', id, c, w, s, t, d: d ?? undefined })),
    ...passiveIds.map((id): Op => ({ op: 'passive', id, on: true })),
    ...Object.entries(kvs).map(([key, value]): Op => ({ op: 'kv', key, value })),
  );
  hydrate({ stats: statRows, passive: passiveIds, kv: kvs });
}

// ---------- Gezinme ----------

export const currentRoute = (s: Snapshot = snap) => s.stack[s.stack.length - 1];

export const nav = {
  push(r: Route) {
    set({ stack: [...snap.stack, keyed(r)] });
  },
  replace(r: Route) {
    set({ stack: [...snap.stack.slice(0, -1), keyed(r)] });
  },
  back() {
    if (snap.dialog) return set({ dialog: null });
    if (snap.stack.length > 1) set({ stack: snap.stack.slice(0, -1) });
  },
  /** Alt menüdeki ana ekranlar: yığını sıfırlar */
  tab(name: 'home' | 'profile' | 'settings') {
    if (snap.stack.length === 1 && snap.stack[0].name === name) return;
    set({ stack: [keyed({ name })] });
  },
  home() {
    set({ stack: [keyed({ name: 'home' })] });
  },
};

// ---------- Pencereler ----------

export function showDialog(dialog: Dialog) {
  set({ dialog });
}

export function closeDialog() {
  set({ dialog: null });
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(toast: string) {
  if (toastTimer) clearTimeout(toastTimer);
  set({ toast });
  toastTimer = setTimeout(() => set({ toast: null }), 2600);
}

/** Testler için: durumu baştan kurar. */
export function __resetForTests() {
  stats.clear();
  passive.clear();
  pending = [];
  snap = { ...snap, ready: false, stack: [keyed({ name: 'home' })], dialog: null, toast: null };
}
