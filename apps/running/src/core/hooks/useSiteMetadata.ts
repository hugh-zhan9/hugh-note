import siteMetadata from '@/static/site-metadata';
import {
  getSummaryYears,
  getDefaultYearSummaryYear,
} from '@/utils/yearSummary';
import { getActivityData } from './useActivities';

const getSiteMetadata = () => {
  const year = getDefaultYearSummaryYear(getSummaryYears(getActivityData()));
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
