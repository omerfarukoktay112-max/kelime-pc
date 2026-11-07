// jsdom'da olmayan tarayıcı API'leri
class RO {
  observe() {}
  disconnect() {}
  unobserve() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= RO;
