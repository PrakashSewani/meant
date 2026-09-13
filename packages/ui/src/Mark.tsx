/**
 * The mark on its own: the two-tone quotation mark, in `currentColor` and the brand's amber. The
 * viewBox is the mark's own bounds rather than the icon's tile, so it fills whatever size it is
 * given instead of floating in dead space.
 */
export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size * (47 / 76)}
      viewBox="27 41 76 47"
      role="img"
      aria-label="Meant"
      className={className}
    >
      <g fill="currentColor">
        <circle cx="50" cy="58" r="15" />
        <path d="M46.25 69.25 C 39 75 32.5 80 29.75 84.25 C 38 82 49 77.5 58.25 70.75 Z" />
      </g>
      <g fill="#f59e0b">
        <circle cx="85" cy="58" r="15" />
        <path d="M81.25 69.25 C 74 75 67.5 80 64.75 84.25 C 73 82 84 77.5 93.25 70.75 Z" />
      </g>
    </svg>
  );
}
