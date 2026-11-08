import siteMetadata from '@/static/site-metadata';
import { getDefaultYearSummaryYear } from '@/utils/yearSummary';
import { summaryYears } from 'virtual:activity-data';

const getSiteMetadata = () => {
  const year = getDefaultYearSummaryYear(summaryYears);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return {
    ...siteMetadata,
    navLinks: siteMetadata.navLinks.map((link) =>
      link.name === '年度总结' && year
        ? { ...link, url: `${base}/summary/${year}` }
        : link
    ),
  };
};

export default getSiteMetadata;
