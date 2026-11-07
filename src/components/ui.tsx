import type { CSSProperties, ReactNode } from 'react';

import { nav } from '@/store/store';
import { Icon } from './Icon';
import { C, Txt } from './Txt';

/** Tüm ekranların kapsayıcısı: ortalanmış sütun + kenar boşluğu. */
export function Screen({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <main className="screen" style={style}>
      {children}
    </main>
  );
}

export function IconButton({ icon, label, onPress }: { icon: 'back' | 'close'; label: string; onPress?: () => void }) {
  return (
    <button type="button" aria-label={label} title={`${label} (Esc)`} onClick={onPress ?? nav.back} className="icon-btn">
      <Icon name={icon} size={icon === 'back' ? 26 : 24} color={C.text} />
    </button>
  );
}

export function ProgressBar({
  value,
  height = 8,
  track,
  fill,
}: {
  /** 0..1 */
  value: number;
  height?: number;
  track?: string;
  fill?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ height, borderRadius: height / 2, ...(track ? { background: track } : null) }}
    >
      {pct > 0 && (
        <div style={{ width: `${pct * 100}%`, minWidth: height, borderRadius: height / 2, ...(fill ? { background: fill } : null) }} />
      )}
    </div>
  );
}

/** Çalışma ekranlarının üst çubuğu: kapat + ilerleme + sayaç. */
export function StudyHeader({ current, total }: { current: number; total: number }) {
  return (
    <div className="row" style={{ gap: 12, flexShrink: 0 }}>
      <IconButton icon="close" label="Kapat" />
      <div style={{ flex: 1 }}>
        <ProgressBar value={total ? current / total : 0} />
      </div>
      <Txt variant="bold" size={15} style={{ minWidth: 48, textAlign: 'right' }}>
        {current} / {total}
      </Txt>
    </div>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  hint,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /** Klavye kısayolu ipucu, ör. "Enter" */
  hint?: string;
}) {
  return (
    <button type="button" className="primary press" onClick={onPress} disabled={disabled}>
      <Txt variant="bold" size={20} color={C.onAccent}>
        {title}
      </Txt>
      {hint && !disabled && (
        <span className="kbd" style={{ color: C.onAccent, marginLeft: 12 }}>
          {hint}
        </span>
      )}
    </button>
  );
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <button type="button" className="link" onClick={onPress}>
      <Txt variant="medium" size={16} color={C.textMuted}>
        {title}
      </Txt>
    </button>
  );
}

/** Tasarımdaki aç/kapa düğmesi. */
export function Switch({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
  const s = value ? 'on' : 'off';
  return (
    <button type="button" role="switch" aria-checked={value} aria-label={label} onClick={onChange} className="switch">
      <span className={`switch-track ${s}`}>
        <span className={`switch-knob ${s}`} />
      </span>
    </button>
  );
}

export function Spacer() {
  return <div className="spacer" />;
}
