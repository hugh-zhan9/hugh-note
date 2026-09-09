import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getActivityData } from '@/core/hooks/useActivities';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import styles from './summary.module.css';
import {
  buildYearSummary,
  formatDuration,
  formatPace,
  getSummaryYears,
  type SummaryMonthColumn,
} from '@/utils/yearSummary';

const LAST_PAGE_INDEX = 5;

const formatDistance = (distanceKm: number): string => distanceKm.toFixed(1);

const cnNumber = (value: number): string => value.toLocaleString('zh-CN');

const getCoverCopy = (year: string, totalRuns: number, runningDays: number) =>
  `${year} 年，你奔跑了 ${totalRuns} 次，跨越 ${runningDays} 个日子。`;

const getIntroCopy = (year: string, totalDistanceKm: number) =>
  `这一年，累积 ${formatDistance(totalDistanceKm)} 公里，步履始终向前。`;

const getTopHighlightDays = (monthlyDayColumns: SummaryMonthColumn[]) => {
  const runDays = monthlyDayColumns
    .flatMap((column) => column.days)
    .filter((day) => day.distanceKm > 0)
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, 5);

  return new Set(runDays.map((day) => day.dateKey));
};

const downloadNodeAsImage = async (node: HTMLElement, fileName: string) => {
  const { width, height } = node.getBoundingClientRect();
  const cloned = node.cloneNode(true) as HTMLElement;
  cloned.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

  const serializer = new XMLSerializer();
  const markup = serializer.serializeToString(cloned);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}">
      <foreignObject width="100%" height="100%">${markup}</foreignObject>
    </svg>
  `;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = 'sync';
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to render summary card'));
    });
    image.src = url;
    await loaded;

    const canvas = document.createElement('canvas');
    const scale = window.devicePixelRatio > 1 ? 2 : 1;
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas context unavailable');
    }

    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
};

const SummaryFooter = ({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) => (
  <>
    <div className={styles.footerHint}>
      <span className={styles.keycap}>空格</span>
      <span className={styles.dot}>，</span>
      <span className={styles.keycap}>回车</span>
      <span className={styles.dot}>，或</span>
      <span className={styles.keycap}>↓</span>
    </div>
    <div className={styles.pageIndicator}>
      {currentPage + 1} / {totalPages}
    </div>
  </>
);

const MobilePager = ({
  currentPage,
  totalPages,
  isOpen,
  onPrevious,
  onNext,
  onToggle,
}: {
  currentPage: number;
  totalPages: number;
  isOpen: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToggle: () => void;
}) => (
  <div className={styles.mobilePager}>
    {isOpen ? (
      <button
        className={styles.mobilePagerButton}
        disabled={currentPage === 0}
        onClick={onPrevious}
        aria-label="上一页"
        type="button"
      >
        ‹
      </button>
    ) : null}
    <button
      className={styles.mobilePagerTrigger}
      onClick={onToggle}
      type="button"
    >
      {currentPage + 1} / {totalPages}
    </button>
    {isOpen ? (
      <button
        className={styles.mobilePagerButton}
        disabled={currentPage === totalPages - 1}
        onClick={onNext}
        aria-label="下一页"
        type="button"
      >
        ›
      </button>
    ) : null}
  </div>
);

const SummaryRoutePage = () => {
  const activities = getActivityData();
  const SUMMARY_YEARS = getSummaryYears(activities);
  const { year } = useParams();
  const latestYear = SUMMARY_YEARS.at(-1) ?? null;

  if (!latestYear) {
    return (
      <main className={styles.root}>
        <div className={styles.emptyState}>没有可用的跑步年度数据。</div>
      </main>
    );
  }

  if (!year) {
    return <Navigate replace to={`/summary/${latestYear}`} />;
  }

  const summary = buildYearSummary(year, activities);

  if (!summary) {
    return <Navigate replace to={`/summary/${latestYear}`} />;
  }

  return (
    <YearSummaryScreen
      year={year}
      latestYear={latestYear}
      summary={summary}
      summaryYears={SUMMARY_YEARS}
    />
  );
};

const YearSummaryScreen = ({
  year,
  latestYear,
  summary,
  summaryYears,
}: {
  year: string;
  latestYear: string;
  summary: NonNullable<ReturnType<typeof buildYearSummary>>;
  summaryYears: string[];
}) => {
  const { siteTitle, siteUrl } = useSiteMetadata();
  const [pageIndex, setPageIndex] = useState(0);
  const [mobilePagerOpen, setMobilePagerOpen] = useState(false);
  const recapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPageIndex(0);
  }, [year]);

  useEffect(() => {
    setMobilePagerOpen(false);
  }, [pageIndex, year]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, select, textarea, button, a, summary, [contenteditable="true"]'
        )
      )
        return;
      if (
        event.key !== ' ' &&
        event.key !== 'Enter' &&
        event.key !== 'ArrowDown'
      ) {
        return;
      }

      event.preventDefault();
      setPageIndex((current) => Math.min(LAST_PAGE_INDEX, current + 1));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!summary) {
    return null;
  }

  const weeklyAverage = (
    summary.totalDistanceKm / summary.weeklyTotals.length
  ).toFixed(1);
  const topDays = getTopHighlightDays(summary.monthlyDayColumns);
  const goPreviousPage = () =>
    setPageIndex((current) => Math.max(0, current - 1));
  const goNextPage = () =>
    setPageIndex((current) => Math.min(LAST_PAGE_INDEX, current + 1));

  const pages = [
    <section key="cover" className={styles.coverPage}>
      <div className={styles.copyBlock}>
        <p className={styles.eyebrow}>{siteTitle}，</p>
        <h1 className={styles.headline}>{year}，步履不停。</h1>
        <p className={styles.lead}>
          {getCoverCopy(year, summary.totalRuns, summary.runningDays)}
          累积 {formatDistance(summary.totalDistanceKm)} 公里。
        </p>
      </div>
    </section>,
    <section key="weekly" className={styles.twoColumnPage}>
      <div className={styles.copyBlock}>
        <p className={styles.eyebrow}>总里程</p>
        <div className={styles.megaValue}>
          {formatDistance(summary.totalDistanceKm)}
        </div>
        <p className={styles.unit}>公里</p>
        <p className={styles.supporting}>周均 {weeklyAverage} 公里</p>
      </div>
      <div className={styles.weekGrid}>
        {summary.weeklyTotals.map((week) => (
          <div
            key={week.week}
            className={`${styles.weekCell} ${week.distanceKm > 0 ? styles.weekCellActive : ''}`}
          >
            <span className={styles.weekLabel}>第{week.week}周</span>
            {week.distanceKm > 0 ? (
              <span className={styles.weekValue}>
                {week.distanceKm.toFixed(1)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>,
    <section key="time" className={styles.chartPage}>
      <div className={styles.copyBlock}>
        <p className={styles.eyebrow}>起跑时刻</p>
        <h2 className={styles.sectionTitle}>晨昏流转，步履不息。</h2>
        <p className={styles.leadSmall}>
          每一个点，都是时间的注脚，记录着迎着晨光，亦或伴着星空的瞬间。
        </p>
      </div>
      <div className={styles.scatterWrapper}>
        <div className={styles.scatterYAxis}>
          {Array.from({ length: 24 }, (_, index) => (
            <span key={index}>{index}</span>
          ))}
        </div>
        <div className={styles.scatterPlot}>
          {Array.from({ length: 24 }, (_, index) => (
            <div
              key={`row-${index}`}
              className={styles.scatterRow}
              style={{ top: `${(index / 23) * 100}%` }}
            />
          ))}
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={`column-${index}`}
              className={styles.scatterColumn}
              style={{ left: `${(index / 11) * 100}%` }}
            />
          ))}
          {summary.startTimePoints.map((point, index) => (
            <button
              key={point.runId}
              className={styles.scatterPoint}
              type="button"
              title={point.label}
              style={{
                left: `${((point.month - 1) / 11) * 100}%`,
                top: `${(point.hour / 23) * 100}%`,
                animationDelay: `${index * 20}ms`,
              }}
            />
          ))}
        </div>
        <div className={styles.scatterMonths}>
          {summary.monthlyDayColumns.map((column) => (
            <span key={column.month}>{column.label}</span>
          ))}
        </div>
      </div>
    </section>,
    <section key="highlights" className={styles.highlightsPage}>
      <div className={styles.copyBlock}>
        <p className={styles.eyebrow}>年度高光</p>
        <h2 className={styles.sectionTitle}>
          {summary.totalRuns} 次奔跑中，这几次尤为难忘。
        </h2>
      </div>
      <div className={styles.highlightsList}>
        <article className={styles.highlightRow}>
          <div className={styles.highlightIndex}>1</div>
          <div className={styles.highlightContent}>
            <p className={styles.highlightLabel}>最长距离</p>
            <div className={styles.highlightValue}>
              {summary.longestRun.distanceKm.toFixed(1)} <span>公里</span>
            </div>
          </div>
          <div className={styles.highlightMeta}>
            {summary.longestRun.dateLabel}
          </div>
        </article>
        <article className={styles.highlightRow}>
          <div className={styles.highlightIndex}>2</div>
          <div className={styles.highlightContent}>
            <p className={styles.highlightLabel}>最长时间</p>
            <div className={styles.highlightValue}>
              {formatDuration(summary.longestDuration.durationSeconds)}
            </div>
          </div>
          <div className={styles.highlightMeta}>
            {summary.longestDuration.dateLabel}
          </div>
        </article>
        <article className={styles.highlightRow}>
          <div className={styles.highlightIndex}>3</div>
          <div className={styles.highlightContent}>
            <p className={styles.highlightLabel}>最多里程次数</p>
            <div className={styles.highlightValue}>
              {summary.mostFrequentDistanceBucket.label}
            </div>
          </div>
          <div className={styles.highlightMeta}>
            {summary.mostFrequentDistanceBucket.count} 次
          </div>
        </article>
      </div>
    </section>,
    <section key="monthly" className={styles.monthlyPage}>
      <div className={styles.copyBlock}>
        <h2 className={styles.sectionTitle}>日积月累，坚持已成习惯。</h2>
        <p className={styles.leadSmall}>
          {getIntroCopy(year, summary.totalDistanceKm)}
        </p>
        <div className={styles.metricRow}>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>跑步天数</span>
            <span className={styles.metricValue}>{summary.runningDays}</span>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>最长连续</span>
            <span className={styles.metricValue}>
              {summary.longestStreakDays}天
            </span>
          </div>
        </div>
      </div>
      <div className={styles.monthColumns}>
        {summary.monthlyDayColumns.map((column) => (
          <div key={column.month} className={styles.monthColumn}>
            <div className={styles.monthName}>{column.label}</div>
            <div className={styles.monthDots}>
              {column.days.map((day) => {
                const level =
                  day.distanceKm >= 10
                    ? styles.dayDotStrong
                    : day.distanceKm >= 5
                      ? styles.dayDotMid
                      : day.distanceKm > 0
                        ? styles.dayDotLight
                        : styles.dayDotEmpty;
                const accent = topDays.has(day.dateKey)
                  ? styles.dayDotAccent
                  : '';

                return (
                  <div
                    key={day.dateKey}
                    className={`${styles.dayDot} ${level} ${accent}`}
                    title={`${column.label}${day.day}日 · ${day.distanceKm.toFixed(1)} 公里`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>,
    <section key="recap" className={styles.recapPage}>
      <div className={styles.recapCard} ref={recapRef}>
        <div className={styles.recapStats}>
          <div className={styles.recapMetaGroup}>
            <span>累计跑步</span>
            <strong>{cnNumber(summary.runningDays)}</strong>
            <span>天</span>
          </div>
          <div className={styles.recapBuckets}>
            <span>距离</span>
            <div>
              <em>1</em>
              <strong>{summary.mostFrequentDistanceBucket.label}</strong>
              <span>{summary.mostFrequentDistanceBucket.count}次</span>
            </div>
            <div>
              <em>2</em>
              <strong>{summary.longestRun.distanceKm.toFixed(1)}K</strong>
              <span>最长单次</span>
            </div>
          </div>
          <div className={styles.recapMetrics}>
            <div>
              <span>里程</span>
              <strong>{summary.totalDistanceKm.toFixed(1)}</strong>
              <span>公里</span>
            </div>
            <div>
              <span>次数</span>
              <strong>{summary.totalRuns}</strong>
            </div>
            <div>
              <span>平均配速</span>
              <strong>{formatPace(summary.averagePaceSeconds)}</strong>
            </div>
            <div>
              <span>连续天数</span>
              <strong>{summary.longestStreakDays}</strong>
              <span>天</span>
            </div>
            <div>
              <span>时间</span>
              <strong>
                {Math.round(summary.totalMovingTimeSeconds / 3600)}
              </strong>
              <span>小时</span>
            </div>
            <div>
              <span>平均单次</span>
              <strong>{summary.averageDistanceKm.toFixed(1)}</strong>
              <span>公里</span>
            </div>
          </div>
          <div className={styles.recapSite}>
            {siteUrl.replace(/^https?:\/\//, '')}/summary/{year}
          </div>
        </div>
        <div className={styles.recapGrid}>
          {summary.monthlyDayColumns.flatMap((column) =>
            column.days.map((day) => {
              const level =
                day.distanceKm >= 10
                  ? styles.dayDotStrong
                  : day.distanceKm >= 5
                    ? styles.dayDotMid
                    : day.distanceKm > 0
                      ? styles.dayDotLight
                      : styles.dayDotEmpty;
              const accent = topDays.has(day.dateKey)
                ? styles.dayDotAccent
                : '';

              return (
                <div
                  key={day.dateKey}
                  className={`${styles.recapDot} ${level} ${accent}`}
                />
              );
            })
          )}
        </div>
      </div>
      <div className={styles.recapActions}>
        <button
          className={styles.primaryButton}
          onClick={() => {
            if (recapRef.current) {
              void downloadNodeAsImage(
                recapRef.current,
                `running-summary-${year}.png`
              );
            }
          }}
          type="button"
        >
          下载
        </button>
        <button
          className={styles.secondaryButton}
          onClick={() => setPageIndex(0)}
          type="button"
        >
          重新开始
        </button>
      </div>
    </section>,
  ];

  return (
    <main className={styles.root}>
      <Helmet>
        <title>{year} 年度总结</title>
      </Helmet>
      <header className={styles.yearSwitch}>
        {summaryYears.map((summaryYear) => (
          <Link
            key={summaryYear}
            className={`${styles.yearLink} ${summaryYear === year ? styles.yearLinkActive : ''}`}
            to={`/summary/${summaryYear}`}
          >
            {summaryYear}
          </Link>
        ))}
        {year !== latestYear ? (
          <Link className={styles.latestLink} to={`/summary/${latestYear}`}>
            最新
          </Link>
        ) : null}
      </header>
      <div className={styles.pageFrame} key={`${year}-${pageIndex}`}>
        {pages[pageIndex]}
      </div>
      <SummaryFooter currentPage={pageIndex} totalPages={pages.length} />
      <MobilePager
        currentPage={pageIndex}
        isOpen={mobilePagerOpen}
        onNext={goNextPage}
        onPrevious={goPreviousPage}
        onToggle={() => setMobilePagerOpen((current) => !current)}
        totalPages={pages.length}
      />
    </main>
  );
};

export default SummaryRoutePage;
