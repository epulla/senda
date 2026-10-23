import { settingsItem } from '@/src/bg/state';
import { useItem } from '@/src/ui/useItem';

// Lucide sun/moon paths (ISC), same icons as Patio's theme toggle.
const icons = {
  sun: [
    'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
    'M12 2v2',
    'M12 20v2',
    'm4.93 4.93 1.41 1.41',
    'm17.66 17.66 1.41 1.41',
    'M2 12h2',
    'M20 12h2',
    'm6.34 17.66-1.41 1.41',
    'm19.07 4.93-1.41 1.41',
  ],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
};

export function ThemeToggle() {
  const [settings, setSettings] = useItem(settingsItem);
  const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = (settings.theme ?? 'system') === 'system' ? systemDark : settings.theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Picking the same mode as the computer goes back to following it.
      onClick={() => void setSettings({ ...settings, theme: !dark === systemDark ? 'system' : dark ? 'light' : 'dark' })}
      className="btn btn-ghost size-8 !p-0"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-[18px]"
      >
        {icons[dark ? 'sun' : 'moon'].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </button>
  );
}
