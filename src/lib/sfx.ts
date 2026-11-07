import type { Settings } from '@/core/settings';

/**
 * Doğru / yanlış ses efektleri. Sesler ilk kullanımda bir kez çözülür.
 * Ses aygıtı (AudioContext) çalarken açılır, kısa süre sonra askıya alınır:
 * arkada açık bekleyen uygulama ses sistemini meşgul etmez.
 */
type Kind = 'correct' | 'wrong';

let ctx: AudioContext | null = null;
const buffers = new Map<Kind, Promise<AudioBuffer | null>>();
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  return ctx;
}

function load(kind: Kind): Promise<AudioBuffer | null> {
  let p = buffers.get(kind);
  if (!p) {
    const c = context();
    p = !c
      ? Promise.resolve(null)
      : fetch(`/sounds/${kind}.wav`)
          .then((r) => r.arrayBuffer())
          .then((b) => c.decodeAudioData(b))
          .catch(() => null);
    buffers.set(kind, p);
  }
  return p;
}

async function play(kind: Kind) {
  const c = context();
  if (!c) return;
  if (idleTimer) clearTimeout(idleTimer);
  const buf = await load(kind);
  if (!buf) return;
  if (c.state === 'suspended') await c.resume().catch(() => {});
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
  const ms = buf.duration * 1000 + 1500;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void c.suspend().catch(() => {}), ms);
}

export function answerFeedback(correct: boolean, settings: Pick<Settings, 'sfx'>) {
  if (settings.sfx) void play(correct ? 'correct' : 'wrong');
}
