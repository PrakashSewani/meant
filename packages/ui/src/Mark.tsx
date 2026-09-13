/**
 * The mark on its own: the opening quote and its sparkle, drawn in `currentColor` so it sits on
 * any surface. The viewBox is the mark's own bounds rather than the icon's tile, so it fills
 * whatever size it is given instead of floating in dead space.
 */
export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size * (72 / 89)}
      viewBox="21 22 89 72"
      role="img"
      aria-label="Meant"
      className={className}
    >
      <g fill="currentColor">
        <circle cx="40" cy="52" r="16" />
        <path d="M36.2 61.9 C 21.6 73.6 12.8 81.6 9.6 91.2 C 27.2 87.2 48 77.8 55.2 65.8 Z" />
        <circle cx="74" cy="52" r="16" />
        <path d="M70.2 61.9 C 55.6 73.6 46.8 81.6 43.6 91.2 C 61.2 87.2 82 77.8 89.2 65.8 Z" />
      </g>
      <path
        d="M97 25 Q 98.4 33.6 107 35 Q 98.4 36.4 97 45 Q 95.6 36.4 87 35 Q 95.6 33.6 97 25 Z"
        fill="#f59e0b"
      />
    </svg>
  );
}
