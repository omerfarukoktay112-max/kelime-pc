import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type Variant = 'regular' | 'medium' | 'bold' | 'display' | 'caps';

interface Props extends HTMLAttributes<HTMLElement> {
  variant?: Variant;
  size?: number;
  color?: string;
  inline?: boolean;
  children?: ReactNode;
}

/**
 * Tüm metinler. Yazı boyutu ayarı ve tema CSS değişkenlerinden gelir (--fs, renkler);
 * bu yüzden Txt hiçbir duruma abone değildir, ayar değişince yeniden çizilmesi gerekmez.
 */
export function Txt({ variant = 'regular', size = 16, color, inline, className, style, ...rest }: Props) {
  const s: CSSProperties = { fontSize: `calc(${size}px * var(--fs))`, ...(color ? { color } : null), ...style };
  const cls = `t t-${variant}${className ? ` ${className}` : ''}`;
  return inline ? <span {...rest} className={cls} style={s} /> : <div {...rest} className={cls} style={s} />;
}

/** CSS değişkenleri: bileşenlerde renk olarak kullanılır. */
export const C = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  border: 'var(--border)',
  accent: 'var(--accent)',
  onAccent: 'var(--on-accent)',
  onAccentTrack: 'var(--on-accent-track)',
  text: 'var(--text)',
  textMuted: 'var(--text-muted)',
  textDisabled: 'var(--text-disabled)',
  ring: 'var(--ring)',
  danger: 'var(--danger)',
} as const;
