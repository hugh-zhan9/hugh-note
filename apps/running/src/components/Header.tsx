import { SiteHeader } from '@/site/SiteHeader';
import { useLocale } from '../hooks/useLocale';
type Page = 'home' | 'tracks';
interface HeaderProps {
  page: Page;
  onNavigate: (page: Page) => void;
}
export function Header({ page, onNavigate }: HeaderProps) {
  const { locale, setLocale, t } = useLocale();
  return (
    <SiteHeader>
      {(['home', 'tracks'] as const).map((item) => (
        <button
          type="button"
          key={item}
          aria-pressed={page === item}
          onClick={() => onNavigate(item)}
        >
          {t(item)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
        aria-label={locale === 'zh' ? 'Switch to English' : '切换中文'}
      >
        {locale === 'zh' ? 'EN' : '中'}
      </button>
    </SiteHeader>
  );
}
