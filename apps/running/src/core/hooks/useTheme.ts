import { useSiteAppearance } from '@/site/appearance';
export function useTheme() {
  const { theme, choose } = useSiteAppearance();
  return {
    dark: theme === 'dark',
    toggle: () => choose(theme === 'dark' ? 'light' : 'dark'),
  };
}
