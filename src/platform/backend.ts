/**
 * Uygulamanın dış dünyayla konuştuğu tek yer. Masaüstünde Tauri (Rust + SQLite),
 * tarayıcıda / testlerde localStorage kullanılır. Ekranlar hangisinin çalıştığını bilmez.
 */

/** Kayıt işlemleri. Her cevap yalnızca o kelimenin satırını günceller; tüm veri yeniden yazılmaz. */
export type Op =
  | { op: 'stat'; id: string; c: number; w: number; s: number; t: number; d?: number }
  | { op: 'passive'; id: string; on: boolean }
  | { op: 'kv'; key: string; value: string }
  | { op: 'clearStats' }
  | { op: 'clearAll' };

export type StatRow = [id: string, c: number, w: number, s: number, t: number, d: number | null];

export interface Loaded {
  stats: StatRow[];
  passive: string[];
  kv: Record<string, string>;
}

export interface Backend {
  /** Masaüstü uygulaması mı (tepsi, dosya pencereleri, konuşma tanıma var mı)? */
  readonly desktop: boolean;
  load(): Promise<Loaded>;
  apply(ops: Op[]): Promise<void>;
  /** Kaydetme penceresi açar; kullanıcı vazgeçerse false. */
  exportBackup(json: string, fileName: string): Promise<boolean>;
  /** Dosya seçtirir ve içeriğini döner; vazgeçerse null. */
  importBackup(): Promise<string | null>;
  openSourcePage(): void;
  setWindowTheme(theme: 'dark' | 'light'): void;
  /** Pencere gizli açılır (beyaz parlama olmasın); ilk çizimden sonra gösterilir. */
  showWindow(): void;
  /** Bu dilde çevrimdışı konuşma tanıma kullanılabilir mi? */
  speechAvailable(lang: string): Promise<boolean>;
  /** Bir kez dinler; duyulan alternatifleri döner (boş = anlaşılamadı). */
  recognize(lang: string, phrases: string[]): Promise<string[]>;
  stopRecognition(): void;
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function tauriBackend(): Promise<Backend> {
  const { invoke } = await import('@tauri-apps/api/core');
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return {
    desktop: true,
    load: () => invoke<Loaded>('load_state'),
    apply: (ops) => invoke('apply_ops', { ops }),
    exportBackup: (json, fileName) => invoke<boolean>('export_backup', { json, fileName }),
    importBackup: () => invoke<string | null>('import_backup'),
    openSourcePage: () => void invoke('open_source_page').catch(() => {}),
    setWindowTheme: (theme) => void getCurrentWindow().setTheme(theme).catch(() => {}),
    showWindow: () => void invoke('window_ready').catch(() => {}),
    speechAvailable: (lang) => invoke<boolean>('speech_available', { lang }).catch(() => false),
    recognize: (lang, phrases) => invoke<string[]>('recognize', { lang, phrases }),
    stopRecognition: () => void invoke('stop_recognition').catch(() => {}),
  };
}

const LS_KEY = 'kelime/pc/v1';

/** Tarayıcıda geliştirme ve testler için. Aynı işlemleri localStorage üzerinde uygular. */
export function localBackend(storage: Storage = window.localStorage): Backend {
  const read = (): Loaded => {
    try {
      const raw = storage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw) as Loaded;
    } catch {}
    return { stats: [], passive: [], kv: {} };
  };
  return {
    desktop: false,
    load: async () => read(),
    apply: async (ops) => {
      const data = read();
      const stats = new Map(data.stats.map((r) => [r[0], r]));
      const passive = new Set(data.passive);
      for (const o of ops) {
        if (o.op === 'stat') stats.set(o.id, [o.id, o.c, o.w, o.s, o.t, o.d ?? null]);
        else if (o.op === 'passive') o.on ? passive.add(o.id) : passive.delete(o.id);
        else if (o.op === 'kv') data.kv[o.key] = o.value;
        else if (o.op === 'clearStats') stats.clear();
        else {
          stats.clear();
          passive.clear();
          data.kv = {};
        }
      }
      storage.setItem(LS_KEY, JSON.stringify({ stats: [...stats.values()], passive: [...passive], kv: data.kv }));
    },
    exportBackup: async (json, fileName) => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
      a.click();
      URL.revokeObjectURL(url);
      return true;
    },
    importBackup: () =>
      new Promise((resolve) => {
        const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
        input.onchange = () => {
          const f = input.files?.[0];
          if (!f) return resolve(null);
          f.text().then(resolve, () => resolve(null));
        };
        input.click();
      }),
    openSourcePage: () => void window.open('https://github.com/tema4p/english-vocabulary', '_blank'),
    setWindowTheme: () => {},
    showWindow: () => {},
    speechAvailable: async () => false,
    recognize: async () => [],
    stopRecognition: () => {},
  };
}

let backend: Backend | null = null;

export async function initBackend(override?: Backend): Promise<Backend> {
  backend = override ?? (isTauri ? await tauriBackend() : localBackend());
  return backend;
}

export function getBackend(): Backend {
  if (!backend) throw new Error('initBackend çağrılmadı');
  return backend;
}
