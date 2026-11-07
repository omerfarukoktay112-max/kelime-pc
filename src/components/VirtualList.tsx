import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Sabit satır yükseklikli sanal liste: yalnızca görünen satırlar (ve birkaç fazlası) çizilir.
 * 1.000 kelimelik seviye listesinde DOM'da her an ~20 satır olur.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  renderRow,
  getKey,
  empty,
  resetKey,
}: {
  items: readonly T[];
  rowHeight: number;
  renderRow: (item: T, top: number) => ReactNode;
  getKey: (item: T) => string;
  empty?: ReactNode;
  /** Değişince listenin başına dönülür (ör. seviye değişince) */
  resetKey?: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setHeight(el.clientHeight || 600);
    const ro = new ResizeObserver(() => setHeight(el.clientHeight || 600));
    ro.observe(el);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrollTop(el.scrollTop);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
    setScrollTop(0);
  }, [resetKey]);

  const overscan = 6;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  const rows: ReactNode[] = [];
  for (let i = start; i < end; i++) rows.push(<Fragment key={getKey(items[i])}>{renderRow(items[i], i * rowHeight)}</Fragment>);

  return (
    <div ref={ref} className="vlist" role="list">
      {items.length === 0 ? empty : <div style={{ height: items.length * rowHeight, position: 'relative' }}>{rows}</div>}
    </div>
  );
}

