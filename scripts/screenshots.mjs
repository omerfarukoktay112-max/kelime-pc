/**
 * README ekran görüntüleri: docs/screenshots/*.png
 *
 *   npm run build && node scripts/screenshots.mjs
 *
 * Örnek bir ilerleme durumuyla (öğrenilmiş kelimeler, büyümüş ağaç, bekleyen tekrarlar) çeker.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const OUT = resolve('docs/screenshots');
mkdirSync(OUT, { recursive: true });
const PORT = 4174;

// ---------- Örnek durum ----------
const words = JSON.parse(readFileSync('src/generated/words.json', 'utf8')).words;
const byLevel = (li) => words.filter((r) => r[0] === li).map((r) => r[1].toLowerCase());
const DAY = 86_400_000;
const now = Date.now();
const today = new Date();
const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const stats = [];
const learned = (ids) => ids.forEach((id, i) => stats.push([id, 5, 0, 4, now - 2 * DAY, now + (5 + (i % 9)) * DAY]));
learned(byLevel(0).slice(0, 312));
learned(byLevel(1).slice(0, 164));
learned(byLevel(2).slice(0, 58));
learned(byLevel(3).slice(0, 12));
// zamanı gelmiş tekrarlar ve hatalar
byLevel(1).slice(200, 224).forEach((id) => stats.push([id, 2, 0, 2, now - 4 * DAY, now - DAY]));
byLevel(2).slice(100, 107).forEach((id) => stats.push([id, 1, 2, 0, now - DAY, now - DAY]));
const state = {
  stats,
  passive: byLevel(0).slice(312, 318),
  kv: {
    settings: JSON.stringify({ dailyGoal: 20, autoplay: false, sfx: false }),
    daily: JSON.stringify({ date: dayKey, count: 14 }),
    garden: JSON.stringify({ days: 32, last: dayKey }),
    lastLevel: JSON.stringify('A2'),
  },
};

// ---------- Çekim ----------
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((ok, fail) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && ok());
  server.on('exit', () => fail(new Error('vite preview başlamadı')));
});
const browser = await chromium.launch();

async function session(theme) {
  const ctx = await browser.newContext({ viewport: { width: 540, height: 820 }, deviceScaleFactor: 2 });
  const s = { ...state, kv: { ...state.kv, settings: JSON.stringify({ ...JSON.parse(state.kv.settings), theme }) } };
  await ctx.addInitScript((data) => {
    if (!localStorage.getItem('kelime/pc/v1')) localStorage.setItem('kelime/pc/v1', data);
  }, JSON.stringify(s));
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.getByText('Seviyeni seç').waitFor();
  await page.waitForTimeout(400);
  return { ctx, page };
}
const snap = async (page, name) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`✓ ${name}`);
};

try {
  const { ctx, page } = await session('dark');
  await snap(page, '01-ana-ekran');

  await page.getByRole('button', { name: /^A2 Temel/ }).click();
  await snap(page, '02-calisma-ayari');

  await page.keyboard.press('Enter');
  await page.getByText('1 / 10').waitFor();
  await page.keyboard.press('2');
  await snap(page, '03-coktan-secmeli');
  await page.keyboard.press('Escape');

  await page.getByRole('radio', { name: /Eşleştirme/ }).click();
  await page.getByRole('button', { name: /Başla/ }).click();
  await page.getByText('Eşleştir', { exact: true }).waitFor();
  // iki doğru eşleşme + bir seçili hücre
  const trOf = new Map(words.map((r) => [r[1], r[2]]));
  for (let i = 0; i < 2; i++) {
    const en = page.locator('.cell-default').first();
    const tr = trOf.get(await en.getAttribute('title'));
    await en.click();
    await page.locator(`.cell-default[title="${tr}"]`).click();
  }
  await page.locator('.cell-default').first().click();
  await snap(page, '04-eslestirme');
  await page.keyboard.press('Escape');

  await page.getByRole('radio', { name: /Sesli/ }).click();
  await page.getByRole('button', { name: /Başla/ }).click();
  await page.getByLabel('İngilizce karşılık').waitFor();
  await snap(page, '05-sesli');
  await page.keyboard.press('Escape');

  await page.getByText('Kelime listesini düzenle').click();
  await page.getByText('A2 kelimeleri').waitFor();
  await snap(page, '06-kelime-listesi');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+2');
  await page.getByText('Öğrenilen kelime', { exact: true }).waitFor();
  await snap(page, '07-profil-agac');

  await page.keyboard.press('Control+3');
  await snap(page, '08-ayarlar');
  await ctx.close();

  const light = await session('light');
  await snap(light.page, '09-ana-ekran-acik');
  await light.page.keyboard.press('Control+2');
  await snap(light.page, '10-profil-acik');
  await light.ctx.close();
} finally {
  await browser.close();
  server.kill();
}
