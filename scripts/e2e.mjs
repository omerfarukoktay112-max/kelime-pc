/**
 * Gerçek Chromium'da (Windows'taki WebView2 ile aynı motor) uçtan uca kontrol ve performans ölçümü.
 *
 *   npm run build && node scripts/e2e.mjs [ekran-görüntüsü-klasörü]
 *
 * Ölçülenler: açılış süresi, JS belleği, DOM düğüm sayısı, boştaki CPU, kelime listesinde
 * pasife alma ve kaydırma maliyeti, çalışma turunda cevap başına süre.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const shots = process.argv[2] ? resolve(process.argv[2]) : null;
if (shots) mkdirSync(shots, { recursive: true });
const PORT = 4173;
const URL = `http://localhost:${PORT}/`;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((ok, fail) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && ok());
  server.on('exit', () => fail(new Error('vite preview başlamadı')));
});

const browser = await chromium.launch();
const results = [];
const failures = [];
const check = (name, cond, detail = '') => {
  results.push(`${cond ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures.push(name);
};

try {
  const page = await browser.newPage({ viewport: { width: 540, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () =>
    Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const shot = (name) => shots && page.screenshot({ path: `${shots}/${name}.png` });

  // ---------- Açılış ----------
  const t0 = Date.now();
  await page.goto(URL);
  await page.getByText('Seviyeni seç').waitFor();
  const startMs = Date.now() - t0;
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) };
  });
  check('ana ekran açıldı', true, `${startMs} ms (DOMContentLoaded ${nav.domContentLoaded} ms)`);
  await page.waitForTimeout(300);
  await shot('01-ana-ekran');
  let m = await metrics();
  check('başlangıç JS belleği < 30 MB', m.JSHeapUsedSize < 30e6, `${(m.JSHeapUsedSize / 1e6).toFixed(1)} MB`);
  check('ana ekran DOM < 400 düğüm', m.Nodes < 400, `${m.Nodes} düğüm`);

  // ---------- Boşta CPU ----------
  const idleA = await metrics();
  await page.waitForTimeout(5000);
  const idleB = await metrics();
  const idleTask = (idleB.TaskDuration - idleA.TaskDuration) * 1000;
  check('boştayken 5 sn içinde iş < 20 ms', idleTask < 20, `${idleTask.toFixed(1)} ms`);

  // ---------- Çoktan seçmeli tur ----------
  await page.getByRole('button', { name: /^A1 Başlangıç/ }).click();
  await page.getByText('Nasıl çalışalım?').waitFor();
  await shot('02-calisma-ayari');
  await page.keyboard.press('Enter');
  await page.getByText('1 / 10').waitFor();
  await shot('03-coktan-secmeli');
  const answerTimes = [];
  for (let i = 0; i < 10; i++) {
    const t = await page.evaluate(() => performance.now());
    await page.keyboard.press(String((i % 4) + 1));
    await page.locator('.opt-correct').waitFor();
    answerTimes.push((await page.evaluate(() => performance.now())) - t);
    if (i === 0) await shot('04-cevaplandi');
    await page.keyboard.press('Enter');
  }
  await page.getByText(/Doğru cevap/).waitFor();
  await shot('05-sonuc');
  const avgAnswer = answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length;
  check('cevap başına tepki < 50 ms', avgAnswer < 50, `ort. ${avgAnswer.toFixed(1)} ms, Playwright gidiş-dönüşü dahil`);
  await page.getByText('Ana ekrana dön').click();
  await page.getByText('Seviyeni seç').waitFor();
  check('tekrar kartı güncellendi', await page.getByRole('button', { name: /^Tekrar, \d+ kelime/ }).isVisible());

  // ---------- Kelime listesi ----------
  await page.getByRole('button', { name: /^A1 Başlangıç/ }).click();
  const tList = Date.now();
  await page.getByText('Kelime listesini düzenle').click();
  await page.getByText('A1 kelimeleri').waitFor();
  await page.locator('[role=listitem]').first().waitFor();
  const listMs = Date.now() - tList;
  const rows = await page.locator('[role=listitem]').count();
  check('kelime listesi hızlı açıldı', listMs < 300, `${listMs} ms`);
  check('yalnızca görünen satırlar çizildi', rows < 40, `${rows} satır DOM'da`);
  await shot('06-kelime-listesi');

  const before = await metrics();
  const toggles = [];
  for (let i = 0; i < 12; i++) {
    const sw = page.locator('[role=switch]').nth(i % 6);
    const t = await page.evaluate(() => performance.now());
    await sw.click();
    toggles.push((await page.evaluate(() => performance.now())) - t);
  }
  const after = await metrics();
  // Tıklama süresine Playwright'ın kendi gidiş-dönüşü de girer; asıl maliyet sayfadaki iş süresi
  const togglePerOp = ((after.TaskDuration - before.TaskDuration) * 1000) / toggles.length;
  check('pasife alma başına iş < 5 ms', togglePerOp < 5, `${togglePerOp.toFixed(2)} ms (tıklama dahil ${(toggles.reduce((a, b) => a + b, 0) / toggles.length).toFixed(1)} ms)`);

  // Listenin sonuna kadar kaydır
  const s0 = await metrics();
  const tScroll = Date.now();
  await page.evaluate(async () => {
    const el = document.querySelector('.vlist');
    for (let y = 0; y < el.scrollHeight; y += 400) {
      el.scrollTop = y;
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  const s1 = await metrics();
  const frames = Math.ceil((await page.evaluate(() => document.querySelector('.vlist').scrollHeight)) / 400);
  const perFrame = ((s1.TaskDuration - s0.TaskDuration) * 1000) / frames;
  check('kaydırmada kare başına iş < 8 ms', perFrame < 8, `${frames} kare, kare başına ${perFrame.toFixed(2)} ms, ${Date.now() - tScroll} ms`);
  check('kaydırma sonrası DOM hâlâ küçük', (await page.locator('[role=listitem]').count()) < 40);

  await page.getByLabel('Kelime ara').fill('house');
  await page.waitForTimeout(100);
  check('arama çalışıyor', await page.locator('[role=listitem]', { hasText: 'house' }).first().isVisible());
  await shot('07-arama');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // ---------- Eşleştirme ----------
  await page.getByRole('button', { name: /^A2 Temel/ }).click();
  await page.getByRole('radio', { name: /Eşleştirme/ }).click();
  await page.getByRole('button', { name: /Başla/ }).click();
  await page.getByText('Eşleştir', { exact: true }).waitFor();
  await page.locator('.cell').first().click();
  await shot('08-eslestirme');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // ---------- Sesli (yazarak) ----------
  await page.getByRole('button', { name: /^A1 Başlangıç/ }).click();
  await page.getByRole('radio', { name: /Sesli/ }).click();
  await page.getByRole('button', { name: /Başla/ }).click();
  await page.getByLabel('İngilizce karşılık').fill('wrong answer');
  await page.keyboard.press('Enter');
  await page.getByText('Kabul edilen cevaplar').waitFor();
  await shot('09-sesli');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // ---------- Profil, ayarlar, açık tema ----------
  await page.keyboard.press('Control+2');
  await page.getByText('Öğrenilen kelime', { exact: true }).waitFor();
  await shot('10-profil');
  await page.keyboard.press('Control+3');
  await page.getByRole('button', { name: /^Tema/ }).click();
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  check('tema değişimi <html>e uygulandı', theme === 'light', theme);
  await page.getByRole('button', { name: /^Yazı boyutu/ }).click();
  const fs = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fs'));
  check('yazı boyutu CSS değişkeniyle uygulandı', fs.trim() === '1.15', fs);
  await shot('11-ayarlar-acik');
  await page.keyboard.press('Control+1');
  await shot('12-ana-ekran-acik');

  // ---------- Kalıcılık ----------
  await page.reload();
  await page.getByText('Seviyeni seç').waitFor();
  const persisted = await page.evaluate(() => document.documentElement.dataset.theme);
  check('yeniden açılışta ayarlar korundu', persisted === 'light');
  check('yeniden açılışta ilerleme korundu', await page.getByRole('button', { name: /^Tekrar, \d+ kelime/ }).isVisible());

  // ---------- Pencere gizlenince ----------
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check('gizliyken animasyonlar duraklatıldı', await page.evaluate(() => document.documentElement.classList.contains('hidden')));

  // Ekranlar arasında gezindikten sonra kopuk DOM / bellek kalmamalı
  await page.keyboard.press('Control+1');
  await cdp.send('HeapProfiler.collectGarbage');
  m = await metrics();
  check('gezinme sonrası DOM sızıntısı yok', m.Nodes < 600, `${m.Nodes} düğüm`);
  check('sayfada hata yok', errors.length === 0, errors.slice(0, 3).join(' | '));
  results.push(`  son JS belleği: ${(m.JSHeapUsedSize / 1e6).toFixed(1)} MB, DOM: ${m.Nodes} düğüm`);
} catch (e) {
  failures.push(String(e));
  results.push(`✗ beklenmeyen hata: ${e}`);
} finally {
  await browser.close();
  server.kill();
}

console.log(results.join('\n'));
if (failures.length) {
  console.error(`\n${failures.length} kontrol başarısız`);
  process.exit(1);
}
console.log('\nTüm kontroller geçti.');
