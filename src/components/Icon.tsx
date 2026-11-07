export type IconName = 'back' | 'close' | 'check' | 'speaker' | 'mic' | 'levels' | 'profile' | 'settings' | 'chevron';

interface Props {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

/** Tasarımdaki SVG ikonları (24x24 viewBox). */
export function Icon({ name, size = 24, color, strokeWidth = 2 }: Props) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
      {name === 'back' && <path d="M15 5l-7 7 7 7" {...common} />}
      {name === 'close' && <path d="M6 6l12 12M18 6L6 18" {...common} />}
      {name === 'check' && <path d="M5 12.5l4.5 4.5L19 7" {...common} />}
      {name === 'chevron' && <path d="M9 6l6 6-6 6" {...common} />}
      {name === 'speaker' && (
        <>
          <path d="M4 9v6h4l5 4V5L8 9H4z" {...common} />
          <path d="M16.5 8.5a5 5 0 0 1 0 7" {...common} />
        </>
      )}
      {name === 'mic' && (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" {...common} />
          <path d="M5 11a7 7 0 0 0 14 0" {...common} />
          <path d="M12 18v3" {...common} />
        </>
      )}
      {name === 'levels' && (
        <>
          <rect x="3" y="7" width="14" height="12" rx="3" {...common} />
          <path d="M7 4h12a2 2 0 0 1 2 2v10" {...common} />
        </>
      )}
      {name === 'profile' && (
        <>
          <circle cx="12" cy="8" r="4" {...common} />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" {...common} />
        </>
      )}
      {name === 'settings' && (
        <>
          <path d="M4 7h10M20 7h0M4 17h2M12 17h8" {...common} />
          <circle cx="17" cy="7" r="2.5" {...common} />
          <circle cx="9" cy="17" r="2.5" {...common} />
        </>
      )}
    </svg>
  );
}
