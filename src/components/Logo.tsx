/** kelime logosu ("Filiz k"): üst kolu yaprak olan küçük harf k. Rengi temadan gelir. */
export function LogoMark({ size = 28, color = 'var(--accent)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" role="img" aria-label="kelime logosu">
      <rect x={54} y={18} width={40} height={200} rx={20} fill={color} />
      <path d="M90 146 L174 212" stroke={color} strokeWidth={40} strokeLinecap="round" />
      <path d="M86 140 C90 82 134 46 202 38 C198 106 154 140 86 140 Z" fill={color} />
    </svg>
  );
}
