/**
 * The mark on its own: the two-tone quotation mark, in `currentColor` and the brand's amber. The
 * viewBox is the mark's own bounds rather than the icon's tile, so it fills whatever size it is
 * given instead of floating in dead space.
 */
export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size * (52 / 60)}
      viewBox="37 41 60 52"
      role="img"
      aria-label="Meant"
      className={className}
    >
      <path
        d="M40 80 C 40 62, 48 50, 62 44 L 66 54 C 57 58, 53 65, 52 72 L 62 72 L 62 92 L 40 80 Z"
        fill="currentColor"
      />
      <path
        d="M70 80 C 70 62, 78 50, 92 44 L 96 54 C 87 58, 83 65, 82 72 L 92 72 L 92 92 L 70 80 Z"
        fill="#f59e0b"
      />
    </svg>
  );
}
