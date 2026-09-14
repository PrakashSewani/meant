import { THEMES, themeLabel, type Theme } from './theme';
import { RING } from './styles';

/** Three states, no menu: the choice is small enough to show in full. */
export function ThemeSwitch({
  theme,
  onChange,
  className = '',
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`inline-flex items-center gap-0.5 rounded-full border border-neutral-300 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-900 ${className}`}
    >
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === theme}
          onClick={() => onChange(option)}
          className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${RING} ${
            option === theme
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
          }`}
        >
          {themeLabel(option)}
        </button>
      ))}
    </div>
  );
}
