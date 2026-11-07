<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/logo/kelime-lockup-dark.svg">
    <img src="design/logo/kelime-lockup-light.svg" alt="kelime" height="72">
  </picture>
</p>

<p align="center"><b>Türkçe arayüzle İngilizce kelime öğren — Windows sürümü.</b><br>
A1'den C2'ye 5.600 kelime · aralıklı tekrar · sesli çalışma · büyüyen bir ağaç</p>

[kelime](https://github.com/omerfarukoktay112-max/kelime) mobil uygulamasının bilgisayar sürümü. Aynı kelime
verisi, aynı tekrar kuralları, aynı tasarım; ama asıl hedef şu: **başka bir işle uğraşırken arkada açık duran
bir İngilizce çalışma uygulaması bilgisayarı yormamalı.**

## Kurulum

[Releases](../../releases/latest) sayfasından `kelime_x.y.z_x64-setup.exe` dosyasını indirip çalıştır.
Yönetici izni istemez (yalnızca senin kullanıcı hesabına kurulur). Windows 10 ve 11'de çalışır.

## Mobil sürümden farkları

| | |
| --- | --- |
| **Sistem tepsisi** | Pencereyi kapatınca uygulama tepside bekler (Ayarlar > Pencere'den kapatılabilir). Tam çıkış: tepsi simgesine sağ tık > Çıkış. İkinci kez açarsan yeni kopya başlamaz, mevcut pencere öne gelir. |
| **Klavye** | Çoktan seçmeli: `1`–`4` (ya da `A`–`D`) seç, `Enter` devam, `Boşluk` dinle. Çalışma ayarı: `1`–`3` mod, `Enter` başla. Sesli: `Enter` kontrol et / devam, `Boşluk` mikrofon. Her yerde `Esc` geri; `Ctrl+1/2/3` Seviyeler / Profil / Ayarlar. Faredeki geri tuşu da çalışır. |
| **Kelime listesi** | Arama kutusu (İngilizce ya da Türkçe). |
| **Seslendirme** | Windows'un yerleşik, internet gerektirmeyen sesleri (ABD / İngiltere). |
| **Sesli mod** | Windows'un çevrimdışı konuşma tanıması. İngilizce konuşma paketi yüklü değilse "yazarak cevapla"ya geçer (Windows Ayarlar > Saat ve dil > Konuşma). |
| **Yedek** | Telefondaki yedek dosyası bilgisayara, bilgisayardaki telefona yüklenebilir (aynı biçim). |
| **Titreşim** | Yok. |

## Neden hafif?

Telefondaki takılmaların kaynağı kelime sayısı değil, verinin işleniş biçimiydi. PC sürümünde her biri ayrı ayrı çözüldü:

| Mobil sürümde | PC sürümünde |
| --- | --- |
| Her metin (`Txt`) ve her renk okuması tüm uygulama durumuna bağlıydı; bir cevap ya da bir anahtar, ekrandaki her yazıyı yeniden çizdiriyordu. | Tema ve yazı boyutu CSS değişkeni. Metin bileşenleri hiçbir duruma abone değil. Ekranlar seçiciyle yalnızca kullandığı değeri dinliyor. |
| Her değişiklikte 5.600 kelime süzülüp tekrar / hata sayıları baştan hesaplanıyordu. | Sayılar ±1 güncelleniyor. Tekrar tarihleri gece yarısına denk geldiği için gece yarısında tek bir yeniden hesap yeterli. Sürekli kontrol yok. |
| Kelime listesi yaklaşık 1.000 satırı ve her birinin bileşenlerini çiziyordu; bir anahtar tüm listeyi yeniden çizdiriyordu. | Sanal liste: DOM'da her an yaklaşık 14 satır var. Satır yalnızca kendi pasif durumu değişince çiziliyor. |
| Açılışta kelime verisi telefonda işleniyordu (eş anlamlılar, çakışmalar…). | Bu iş derleme anında yapılıyor (`scripts/compile-words.mjs`). Açılışta tek bir `JSON.parse` çalışıyor. |
| Her değişiklikten sonra tüm ilerleme tek parça JSON olarak yeniden yazılıyordu. | SQLite (WAL kipi). Bir cevap yalnızca o kelimenin satırını güncelliyor; aynı anda gelen değişiklikler tek işlemde yazılıyor. |
| Her soru için 5.600 kelimelik liste kopyalanıp karıştırılıyordu. | Çeldiriciler rastgele örnekleniyor. |

Bunlara ek olarak:
- Pencere tepsiye gizlenince ya da simge durumuna küçültülünce **WebView2 askıya alınıyor** (`TrySuspend`): sayfa donuyor, CPU kullanımı sıfırlanıyor, belleğin bir kısmı geri veriliyor.
- Ses efektlerinin ses aygıtı yalnızca çalarken açık, sonra askıya alınıyor.
- Electron yerine **Tauri**: Windows'ta zaten yüklü olan WebView2 kullanılıyor, uygulamanın içinde ayrı bir tarayıcı gelmiyor.
- Fontlar uygulamanın içinde; internet bağlantısı hiç gerekmiyor.

### Ölçümler

`npm run e2e`, Chromium'da (WebView2 ile aynı motor) çalışır:

| | |
| --- | --- |
| Açılış (ana ekran çizildi) | ~65 ms |
| JS belleği (açılış / gezinme sonrası) | ~7 MB / ~6 MB |
| Boşta, 5 saniyede yapılan iş | ~1 ms |
| Kelime listesini açma | ~37 ms, DOM'da 14 satır |
| Pasife alma (işlem başına) | ~3 ms |
| Kaydırma (kare başına) | ~3 ms |

Windows'taki gerçek uygulamanın ölçümleri (bellek, boşta ve simge durumundayken CPU, kurulum boyutu) her derlemede
GitHub Actions'ta `scripts/smoke-test.ps1` ile alınır. `smoke-report.txt` derleme çıktısındadır.

## Geliştirme

Gerekenler: Node.js 20+, Rust (stable). Windows'ta ek olarak WebView2 (Windows 10/11'de hazır gelir) ve
"Desktop development with C++" (Visual Studio Build Tools).

```bash
npm install
npx tauri dev           # masaüstü uygulaması (değişiklikte yenilenir)
npm run dev             # yalnızca arayüz, tarayıcıda (kayıt localStorage'a yazılır)

npm test                # mantık, durum ve ekran testleri (Vitest)
npm run e2e             # Chromium'da uçtan uca kontrol ve performans ölçümü (önce: npm run build, npx playwright install chromium)
cd src-tauri && cargo test   # SQLite katmanı

npx tauri build         # Windows kurulum dosyası: src-tauri/target/release/bundle/nsis/
```

Windows kurulum dosyası Mac'ten üretilmez; `main` dalına her gönderimde ya da `v*` etiketinde
GitHub Actions (`.github/workflows/windows.yml`) Windows'ta test eder, derler ve ölçer. Etiketli sürümler Releases'e yüklenir.

### Kelime verisi

`data/words.source.json` mobil projedeki `assets/data/words.json` ile aynı dosyadır (biçimi orada anlatılıyor).
Güncellemek için dosyayı değiştirmen yeterli; `npm run words` (build ve testler bunu kendisi çalıştırır)
`src/generated/words.json` dosyasını yeniden üretir.

## Yapı

```
scripts/compile-words.mjs   Kelime verisini derleme anında hazırlar
src/
  core/                     Mobil sürümle ortak mantık: srs (aralıklı tekrar), tree (ağaç), session (kelime seçimi), answer, words
  store/store.ts            Uygulama durumu: artımlı sayaçlar, seçicili abonelik, kayıt kuyruğu, gezinme, yedek
  platform/backend.ts       Tauri (SQLite, dosya pencereleri, konuşma tanıma) ya da tarayıcı (localStorage)
  lib/                      Seslendirme, ses efektleri, konuşma tanıma, klavye kısayolları
  screens/                  Ana ekran, çalışma ayarı, çoktan seçmeli, eşleştirme, sesli, sonuç, profil, ayarlar, kelime listesi
  components/               Txt, Icon, Tree, Logo, TabBar, VirtualList, ui, Overlays
  styles.css                Tema (CSS değişkenleri) ve tüm stiller
src-tauri/src/
  lib.rs                    Pencere, tepsi, askıya alma, komutlar
  db.rs                     SQLite
  win.rs                    Yalnızca Windows: WebView2 askıya alma, konuşma tanıma
tests/                      Vitest testleri
```

## Kaynaklar ve lisans

- Uygulama kodu: **MIT** (bkz. [LICENSE](LICENSE)).
- Türkçe anlamlar: [tema4p/english-vocabulary](https://github.com/tema4p/english-vocabulary) (Oxford 5000 Türkçe listesi), **CC BY-NC 4.0**.
  Anlamlar gözden geçirilip düzenlendi. Bu lisans nedeniyle kelime verisi ticari amaçla kullanılamaz.
- Fontlar: Bricolage Grotesque ve DM Sans (SIL Open Font License, `@fontsource`).
- Ses efektleri bu proje için üretildi.
