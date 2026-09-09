import type { PropsWithChildren } from 'react';

export function SiteHeader({ children }: PropsWithChildren) {
  return (
    <header className="site-header">
      <a className="site-brand" href="/">
        牧己
      </a>
      <nav aria-label="站点导航">
        <a href="/blog/">文章</a>
        <a href="/crazy-talk/">碎念</a>
        <a href="/running/">跑步</a>
        {children}
      </nav>
    </header>
  );
}
