import { memo } from 'react';

/** Yaprak kümesi (taç) daireleri: [x, y, yarıçap] — 200x200 alanda */
const CANOPY_SMALL: [number, number, number][] = [
  [100, 96, 30],
  [78, 110, 22],
  [122, 110, 22],
];
const CANOPY_BIG: [number, number, number][] = [
  [100, 70, 38],
  [66, 92, 30],
  [134, 92, 30],
  [84, 116, 28],
  [116, 116, 28],
  [100, 100, 34],
];
const FLOWERS: [number, number][] = [
  [80, 70], [118, 60], [140, 98], [64, 104], [100, 120], [122, 122], [92, 90],
];

/**
 * Ağacın aşamaya göre çizimi.
 * stage: 0 tohum · 1 filiz · 2 fidan · 3 genç ağaç · 4 ağaç · 5 çiçekli · 6 meyveli
 * thirsty: solgun yapraklar (son günlerde hedef tamamlanmadı)
 */
export const Tree = memo(function Tree({ stage, thirsty, size = 160 }: { stage: number; thirsty?: boolean; size?: number }) {
  const leaf = thirsty ? 'var(--text-disabled)' : 'var(--leaf)';
  const leafShade = thirsty ? 'var(--ring)' : 'var(--leaf-shade)';
  const trunk = 'var(--trunk)';
  const canopy = stage === 3 ? CANOPY_SMALL : CANOPY_BIG;

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden style={{ flexShrink: 0 }}>
      <ellipse cx={100} cy={178} rx={70} ry={12} fill="var(--soil)" />

      {stage === 0 && <ellipse cx={100} cy={172} rx={9} ry={6} fill={trunk} />}

      {stage === 1 && (
        <g>
          <path d="M100 176 C100 162 100 156 100 148" stroke={leafShade} strokeWidth={4} strokeLinecap="round" fill="none" />
          <path d="M100 152 C88 150 82 142 84 134 C94 136 100 144 100 152 Z" fill={leaf} />
          <path d="M100 150 C112 148 118 140 116 132 C106 134 100 142 100 150 Z" fill={leaf} />
        </g>
      )}

      {stage === 2 && (
        <g>
          <path d="M100 176 C100 150 98 130 100 110" stroke={trunk} strokeWidth={5} strokeLinecap="round" fill="none" />
          <path d="M100 140 C86 140 76 130 78 120 C90 122 100 130 100 140 Z" fill={leaf} />
          <path d="M100 132 C114 132 124 122 122 112 C110 114 100 122 100 132 Z" fill={leaf} />
          <path d="M100 116 C90 114 86 104 90 96 C98 100 102 108 100 116 Z" fill={leafShade} />
          <path d="M100 114 C110 112 114 102 110 94 C102 98 98 106 100 114 Z" fill={leaf} />
        </g>
      )}

      {stage >= 3 && (
        <g>
          <path d={stage === 3 ? 'M94 176 L97 120 L103 120 L106 176 Z' : 'M90 176 L95 104 L105 104 L110 176 Z'} fill={trunk} />
          {stage >= 4 && (
            <>
              <path d="M98 130 L76 108" stroke={trunk} strokeWidth={5} strokeLinecap="round" />
              <path d="M102 122 L126 100" stroke={trunk} strokeWidth={5} strokeLinecap="round" />
            </>
          )}
          {canopy.map(([x, y, r], i) => (
            <circle key={`s${i}`} cx={x + 3} cy={y + 4} r={r} fill={leafShade} />
          ))}
          {canopy.map(([x, y, r], i) => (
            <circle key={`l${i}`} cx={x} cy={y} r={r} fill={leaf} />
          ))}
          {stage >= 5 &&
            !thirsty &&
            FLOWERS.map(([x, y], i) =>
              stage === 6 && i % 2 === 0 ? (
                <circle key={`f${i}`} cx={x} cy={y} r={6} fill="var(--fruit)" />
              ) : (
                <g key={`f${i}`}>
                  <circle cx={x} cy={y} r={5} fill="var(--flower)" />
                  <circle cx={x} cy={y} r={2} fill="var(--fruit)" />
                </g>
              ),
            )}
        </g>
      )}
    </svg>
  );
});
