import { useSyncExternalStore } from 'react';

declare global {
  interface Window {
    siteAppearance: {
      choose: (value: string) => void;
      getPreference: () => string;
      subscribe: (listener: () => void) => () => void;
      mount: (settings: HTMLElement) => () => void;
    };
  }
}

export const getSiteTheme = (): 'light' | 'dark' =>
  typeof document !== 'undefined' &&
  document.documentElement.dataset.theme === 'dark'
    ? 'dark'
    : 'light';

export function useSiteAppearance() {
  const skin = useSyncExternalStore(
    window.siteAppearance.subscribe,
    window.siteAppearance.getPreference,
    () => 'light'
  );
  return { skin, theme: getSiteTheme(), choose: window.siteAppearance.choose };
}
