import { useSiteAppearance } from '@/site/appearance';
import { MAP_TILE_STYLE_LIGHT, MAP_TILE_STYLE_DARK } from '../utils/const';
export type Theme = 'light' | 'dark';
export const getMapThemeFromCurrentTheme = (theme: Theme): string =>
  theme === 'dark' ? MAP_TILE_STYLE_DARK : MAP_TILE_STYLE_LIGHT;
export const useMapTheme = () =>
  getMapThemeFromCurrentTheme(useSiteAppearance().theme);
export const useTheme = () => {
  const { theme, choose } = useSiteAppearance();
  return { theme, setTheme: (value: Theme) => choose(value) };
};
export const useThemeChangeCounter = () => useSiteAppearance().skin;
