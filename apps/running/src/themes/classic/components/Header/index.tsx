import { SiteHeader } from '@/site/SiteHeader';
import getSiteMetadata from '@/core/hooks/useSiteMetadata';
export default function Header() {
  const annualSummary = getSiteMetadata().navLinks.find(
    (link) => link.name === '年度总结'
  );
  return (
    <SiteHeader>
      <a href="/running/summary/">汇总</a>
      {annualSummary && <a href={annualSummary.url}>年度总结</a>}
    </SiteHeader>
  );
}
