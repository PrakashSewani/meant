/**
 * The mark on its own, drawn for small sizes rather than scaled down from the app icon: the pen
 * is a sixth of the box wide, which is what makes it read at 18px. `currentColor` for the pen,
 * the brand's amber for the sparkle.
 */
export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Meant"
      className={className}
    >
      <rect x="11.5" y="3" width="9" height="12" rx="3" fill="currentColor" />
      <path
        d="M11.5 16.5 C 11.5 16.5, 13.5 24, 16 29.5 C 18.5 24, 20.5 16.5, 20.5 16.5 Z"
        fill="currentColor"
      />
      <circle cx="16" cy="20.5" r="1.1" fill="var(--meant-mark-cut, #fff)" />
      <rect x="15.5" y="22.5" width="1" height="7" rx="0.5" fill="var(--meant-mark-cut, #fff)" />
      <path
        d="M26 4.5 Q 26.7 7.8 30 8.5 Q 26.7 9.2 26 12.5 Q 25.3 9.2 22 8.5 Q 25.3 7.8 26 4.5 Z"
        fill="#f59e0b"
      />
    </svg>
  );
}
