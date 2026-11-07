import { SPEECH_RATE_VALUE, type Settings } from '@/core/settings';

type Accent = Settings['accent'];

/**
 * Seslendirme: Windows'un yerleşik sesleri (Web Speech API, WebView2 üzerinden).
 * İnternet gerektirmeyen (localService) sesler tercih edilir; "Online" sesler gecikmeli başlar.
 */

/** Harf harf ya da yanlış okunan kelimeler için seslendirme metni. */
const PRONUNCIATION: Record<string, string> = {
  'a.m.': 'A M',
  'p.m.': 'P M',
  'etc.': 'et cetera',
  'e.g.': 'for example',
  'i.e.': 'that is',
  'approx.': 'approximately',
};

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
const voiceCache = new Map<Accent, SpeechSynthesisVoice | null>();

const norm = (lang: string) => lang.replace('_', '-').toLowerCase();

function pickVoice(accent: Accent): SpeechSynthesisVoice | null {
  if (voiceCache.has(accent)) return voiceCache.get(accent) ?? null;
  const voices = synth?.getVoices() ?? [];
  // Ses listesi henüz gelmediyse önbelleğe yazma; bir sonraki çağrıda yeniden bak
  if (voices.length === 0) return null;
  const target = accent.toLowerCase();
  const score = (v: SpeechSynthesisVoice) =>
    (v.localService ? 4 : 0) + (/natural/i.test(v.name) ? 1 : 0) + (/online/i.test(v.name) ? -2 : 0);
  const chosen = voices.filter((v) => norm(v.lang) === target).sort((a, b) => score(b) - score(a))[0] ?? null;
  voiceCache.set(accent, chosen);
  return chosen;
}

synth?.addEventListener?.('voiceschanged', () => voiceCache.clear());

/** İngilizce kelimeyi ayarlardaki aksan ve hızla seslendirir. */
export function speakEnglish(text: string, settings: Pick<Settings, 'accent' | 'speechRate'>) {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(PRONUNCIATION[text.toLowerCase()] ?? text);
  u.lang = settings.accent;
  const voice = pickVoice(settings.accent);
  if (voice) u.voice = voice;
  u.rate = SPEECH_RATE_VALUE[settings.speechRate];
  synth.speak(u);
}

export function stopSpeaking() {
  synth?.cancel();
}
