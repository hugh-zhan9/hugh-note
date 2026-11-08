import React from 'react';
import { SiteHeader } from './SiteHeader';

export function LoadingSections() {
  return (
    <main
      className="running-loading"
      aria-busy="true"
      aria-label="跑步记录正在加载"
    >
      <section>
        <h1>跑步记录</h1>
        <p>统计和活动记录正在准备中，你可以先浏览其他栏目。</p>
        <div className="loading-card">
          <h2>活动统计</h2>
          <div className="loading-bars" />
        </div>
      </section>
      <section>
        <div className="loading-card loading-map">
          <h2>跑步地图</h2>
          <p>路线将单独加载</p>
        </div>
        <div className="loading-card">
          <h2>活动记录</h2>
          <div className="loading-bars" />
        </div>
      </section>
    </main>
  );
}

export function LoadingShell() {
  return (
    <div className="running-shell">
      <SiteHeader>
        <a href="/running/summary/">汇总</a>
      </SiteHeader>
      <LoadingSections />
    </div>
  );
}
