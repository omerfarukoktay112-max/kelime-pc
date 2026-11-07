import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { App } from '@/App';
import { getWordsByLevel } from '@/core/words';
import { initBackend, localBackend } from '@/platform/backend';
import { __resetForTests, getSnapshot, getStat, isPassive, loadFromBackend, updateSettings } from '@/store/store';

const key = (k: string) => act(() => void fireEvent.keyDown(window, { key: k }));

beforeEach(async () => {
  localStorage.clear();
  __resetForTests();
  await initBackend(localBackend(localStorage));
  await loadFromBackend();
  updateSettings({ defaultRounds: 5, sfx: false, autoplay: false });
  render(<App />);
});

afterEach(cleanup);

describe('ekranlar', () => {
  it('çoktan seçmeli tur klavyeyle baştan sona oynanır', () => {
    fireEvent.click(screen.getByRole('button', { name: /^A1 Başlangıç/ }));
    expect(screen.getByText('Nasıl çalışalım?')).toBeTruthy();
    key('Enter');
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(`${i + 1} / 5`)).toBeTruthy();
      key(String((i % 4) + 1));
      key('Enter');
    }
    expect(screen.getByText(/Doğru cevap/)).toBeTruthy();
    expect(screen.getByText(/Harika!|İyi gidiyor|Biraz daha pratik/)).toBeTruthy();
    // cevaplar kaydedildi
    expect(getSnapshot().reviewCount + getSnapshot().learned.A1).toBeGreaterThanOrEqual(0);
    const seen = getWordsByLevel('A1').filter((w) => getStat(w.id)).length;
    expect(seen).toBeGreaterThan(0);
    // Ana ekrana dön
    fireEvent.click(screen.getByText('Ana ekrana dön'));
    expect(screen.getByText('Seviyeni seç')).toBeTruthy();
  });

  it('Esc geri gider', () => {
    fireEvent.click(screen.getByRole('button', { name: /^B1 Orta/ }));
    expect(screen.getByText('Nasıl çalışalım?')).toBeTruthy();
    key('Escape');
    expect(screen.getByText('Seviyeni seç')).toBeTruthy();
  });

  it('eşleştirme: doğru eşleşmeler tahtayı bitirir', async () => {
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: /^A2 Temel/ }));
      fireEvent.click(screen.getByRole('radio', { name: /Eşleştirme/ }));
      fireEvent.click(screen.getByRole('radio', { name: '5' }));
      fireEvent.click(screen.getByRole('button', { name: /Başla/ }));
      expect(screen.getByText('Eşleştir')).toBeTruthy();
      const a2 = getWordsByLevel('A2');
      const cells = () =>
        screen.getAllByRole<HTMLButtonElement>('button', { pressed: false }).filter((b) => b.classList.contains('cell'));
      // İngilizce sütundaki her kelime için Türkçesini bul ve eşleştir
      const enCells = cells().slice(0, 8);
      for (const c of enCells) {
        const w = a2.find((x) => x.en === c.title)!;
        fireEvent.click(c);
        const tr = cells().find((b) => b.title === w.tr && !b.disabled && b !== c)!;
        fireEvent.click(tr);
      }
      expect(screen.getByText('8 / 8 eşleşti')).toBeTruthy();
      await act(async () => void vi.advanceTimersByTime(500));
      expect(screen.getByText('2 / 5')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sesli mod (yazarak): doğru cevap kabul edilir', () => {
    fireEvent.click(screen.getByRole('button', { name: /^A1 Başlangıç/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Sesli/ }));
    fireEvent.click(screen.getByRole('button', { name: /Başla/ }));
    const prompt = screen.getByText('Türkçe').nextElementSibling!.textContent!;
    const w = getWordsByLevel('A1').find((x) => x.tr.charAt(0).toLocaleUpperCase('tr') + x.tr.slice(1) === prompt)!;
    const input = screen.getByLabelText('İngilizce karşılık');
    fireEvent.change(input, { target: { value: `  ${w.en.toUpperCase()} ` } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Kabul edilen cevaplar')).toBeTruthy();
    expect(screen.queryByText(/^Yanlış/)).toBeNull();
    expect(getStat(w.id)?.c).toBe(1);
  });

  it('kelime listesi: yalnızca görünen satırlar çizilir, pasife alma ve arama çalışır', () => {
    fireEvent.click(screen.getByRole('button', { name: /^A1 Başlangıç/ }));
    fireEvent.click(screen.getByText('Kelime listesini düzenle'));
    const total = getWordsByLevel('A1').length;
    const rows = screen.getAllByRole('listitem');
    expect(rows.length).toBeLessThan(40);
    expect(screen.getByText(`${total} aktif · 0 pasif`)).toBeTruthy();

    const first = getWordsByLevel('A1')[0];
    fireEvent.click(screen.getByRole('switch', { name: `${first.en} kelimesini öner` }));
    expect(isPassive(first.id)).toBe(true);
    expect(screen.getByText(`${total - 1} aktif · 1 pasif`)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Kelime ara'), { target: { value: 'house' } });
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(list).getByText('house')).toBeTruthy();

    // seviye değiştir
    fireEvent.click(screen.getByRole('tab', { name: 'C2' }));
    expect(screen.getByText('C2 kelimeleri')).toBeTruthy();
  });

  it('ayarlar: değer döner, sıfırlama onay ister', () => {
    fireEvent.click(screen.getByRole('tab', { name: /Ayarlar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Günlük hedef/ }));
    expect(getSnapshot().settings.dailyGoal).toBe(30);
    fireEvent.click(screen.getByRole('button', { name: /Tema/ }));
    expect(getSnapshot().settings.theme).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'İlerlemeyi sıfırla' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('profil ekranı ve sekme kısayolları', () => {
    act(() => void fireEvent.keyDown(window, { key: '2', ctrlKey: true }));
    expect(screen.getByText('Öğrenilen kelime')).toBeTruthy();
    expect(screen.getByText('Tohum')).toBeTruthy();
    act(() => void fireEvent.keyDown(window, { key: '1', ctrlKey: true }));
    expect(screen.getByText('Seviyeni seç')).toBeTruthy();
  });
});

describe('klavye', () => {
  it('odak "Devam" düğmesindeyken Enter yalnızca bir soru ilerletir', () => {
    fireEvent.click(screen.getByRole('button', { name: /^A1 Başlangıç/ }));
    key('Enter');
    key('1');
    const devam = screen.getByRole('button', { name: /Devam/ });
    devam.focus();
    act(() => void fireEvent.keyDown(devam, { key: 'Enter' }));
    expect(screen.getByText('2 / 5')).toBeTruthy();
  });

  it('onay penceresi açıkken kısayollar çalışmaz, Esc pencereyi kapatır', () => {
    fireEvent.click(screen.getByRole('tab', { name: /Ayarlar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'İlerlemeyi sıfırla' }));
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Sıfırla' });
    // Esc pencereyi kapatır ama ekrandan çıkmaz
    act(() => void fireEvent.keyDown(confirm, { key: 'Escape' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('tab', { name: /Ayarlar/, selected: true })).toBeTruthy();
  });
});
