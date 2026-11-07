/**
 * Kelime verisini derleme anında hazırlar: data/words.source.json -> src/generated/words.json
 *
 * Mobil sürüm bu işi (eş anlamlı grupları, çakışan anlamlar, ekranda gösterilecek karşılık)
 * her açılışta telefonda yapıyordu. Burada bir kez yapılır; uygulama yalnızca hazır listeyi okur.
 *
 * Çıktı: { v: 1, words: Row[] }
 *   Row = [seviye (0-5), en, tr (ekranda), trAccepted[], enAlt[], ck[], note?]
 *   enAlt: aynı anlam grubundaki diğer İngilizce kelimeler (sesli modda doğru sayılır)
 *   ck: çakışma anahtarları. İki kelimenin ortak bir anahtarı varsa aynı soruda / tahtada yan yana çıkmaz.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'data/words.source.json');
const OUT = resolve(root, 'src/generated/words.json');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const strings = (v) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : [];

/** "saat (süre)" -> "saat" ; src/core/words.ts içindeki meaningKey ile aynı */
const meaningKey = (s) => s.replace(/\s*\(.*?\)\s*/g, ' ').trim().toLocaleLowerCase('tr');

export function compile(data) {
  const entries = [];
  let skipped = 0;
  LEVELS.forEach((level, li) => {
    const list = Array.isArray(data[level]) ? data[level] : [];
    for (const r of list) {
      const en = typeof r?.word === 'string' ? r.word.trim() : '';
      const tr = strings(r?.turkish);
      if (!en || tr.length === 0) {
        skipped++;
        continue;
      }
      const group = strings(r.meaning_groups)[0] ?? tr[0];
      entries.push({ li, en, tr, group, note: typeof r.usage_note === 'string' ? r.usage_note : undefined });
    }
  });

  const byGroup = new Map();
  const groupsByMain = new Map();
  for (const e of entries) {
    let g = byGroup.get(e.group);
    if (!g) byGroup.set(e.group, (g = []));
    g.push(e.en);
    const k = meaningKey(e.tr[0]);
    let s = groupsByMain.get(k);
    if (!s) groupsByMain.set(k, (s = new Set()));
    s.add(e.group);
  }

  // Çakışma anahtarlarını küçük sayılara çevir (grup adı ve sadeleştirilmiş anlamlar)
  const keyIds = new Map();
  const keyId = (k) => {
    let id = keyIds.get(k);
    if (id === undefined) keyIds.set(k, (id = keyIds.size));
    return id;
  };

  const ids = new Set();
  const rows = [];
  for (const e of entries) {
    const id = e.en.toLowerCase();
    if (ids.has(id)) {
      skipped++;
      continue;
    }
    ids.add(id);
    const ambiguous = groupsByMain.get(meaningKey(e.tr[0])).size > 1;
    const display = ambiguous && /\(.+\)/.test(e.group) ? e.group : e.tr[0];
    const enAlt = byGroup.get(e.group).filter((w) => w !== e.en);
    const trKeys = [...new Set([...e.tr, e.group].map(meaningKey))];
    const ck = [...new Set([keyId(`g:${e.group}`), ...trKeys.map((k) => keyId(`k:${k}`))])];
    const row = [e.li, e.en, display, e.tr, enAlt, ck];
    if (e.note) row.push(e.note);
    rows.push(row);
  }
  return { out: { v: 1, words: rows }, skipped };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { out, skipped } = compile(JSON.parse(readFileSync(SRC, 'utf8')));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`[words] ${out.words.length} kelime hazırlandı${skipped ? `, ${skipped} kayıt atlandı` : ''}.`);
}
