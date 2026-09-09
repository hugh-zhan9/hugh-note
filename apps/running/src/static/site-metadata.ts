interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const getBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL;
  return baseUrl.replace(/\/$/, '');
};

const data: ISiteMetadataResult = {
  siteTitle: '牧己的跑步记录',
  siteUrl: new URL(getBasePath(), window.location.origin).href,
  logo: 'https://cdn.v2ex.com/avatar/1872/c12d/546693_xlarge.png?m=1730771302',
  description: 'Personal site and blog',
  navLinks: [
    // {
    //   name: 'Summary',
    //   url: '/summary',
    // },
    {
      name: 'Summary',
      url: `${getBasePath()}/summary`,
    },
    {
      name: '年度总结',
      url: `${getBasePath()}/summary`,
    },
    {
      name: 'Blog',
      url: 'https://hugh-zhan9.github.io',
    },
    // {
    //   name: 'About',
    //   url: 'https://github.com/yihong0618/running_page/blob/master/README-CN.md',
    // },
  ],
};

export default data;
