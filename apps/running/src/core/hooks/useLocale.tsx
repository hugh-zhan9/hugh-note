import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { messages, type Locale } from '../i18n';
import { DEFAULT_LOCALE } from '../config';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem('locale');
      return (stored as Locale) || DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem('locale', l);
    } catch {
      /* Locale still works for this page. */
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      return messages[locale][key] || key;
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
