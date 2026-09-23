import { useEffect, useRef, useState, type FormEvent } from 'react';
import { decryptTrainingReport } from '../utils/trainingCrypto';
import {
  parsePrivateAdvice,
  parseTrainingReport,
  type PrivateTrainingAdvice,
  type TrainingReport,
} from '../utils/trainingReport';
import { shiftTrainingDate, trainingDate } from '../utils/trainingSummary';
import styles from './TrainingAdvice.module.css';

const pace = (seconds: number | null) =>
  seconds === null
    ? '—'
    : `${Math.floor(seconds / 60)}′${String(seconds % 60).padStart(2, '0')}″`;

function PrivateReport({
  report,
}: {
  report: Extract<TrainingReport, { status: 'ready' }>;
}) {
  const [advice, setAdvice] = useState<PrivateTrainingAdvice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef({ version: 0 });
  const lock = () => {
    attemptRef.current.version++;
    if (passwordRef.current) passwordRef.current.value = '';
    setAdvice(null);
    setError('');
    setBusy(false);
  };
  useEffect(() => {
    const attempt = attemptRef.current;
    const hide = () => {
      if (document.hidden) lock();
    };
    window.addEventListener('pagehide', lock);
    document.addEventListener('visibilitychange', hide);
    return () => {
      attempt.version++;
      window.removeEventListener('pagehide', lock);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordRef.current || busy) return;
    const secret = passwordRef.current.value;
    passwordRef.current.value = '';
    const currentAttempt = ++attemptRef.current.version;
    setBusy(true);
    setError('');
    try {
      const plaintext = await decryptTrainingReport(
        report.privateReport,
        secret,
        report.reportId
      );
      const result = parsePrivateAdvice(JSON.parse(plaintext));
      if (currentAttempt === attemptRef.current.version) setAdvice(result);
    } catch {
      if (currentAttempt === attemptRef.current.version)
        setError('无法解锁，请检查密码；报告损坏时也会出现此提示。');
    } finally {
      if (currentAttempt === attemptRef.current.version) setBusy(false);
    }
  };
  return (
    <div className={styles.private} data-testid="private-training">
      <div className={styles.heading}>
        <h3>私人解读</h3>
        {advice && (
          <button type="button" onClick={lock}>
            锁定
          </button>
        )}
      </div>
      {advice ? (
        <div aria-live="polite">
          {advice.sections.map((section) => (
            <div
              key={`${section.heading}:${section.body}`}
              className={styles.privateSection}
            >
              <h4>{section.heading}</h4>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className={styles.muted}>
            输入密码查看，仅在本次页面中显示。切换到后台或刷新后自动锁定。
          </p>
          <form onSubmit={unlock} className={styles.unlock}>
            <label className={styles.passwordLabel}>
              报告密码
              <input
                ref={passwordRef}
                type="password"
                autoComplete="off"
                maxLength={256}
                required
                disabled={busy}
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? '正在解锁…' : '解锁私人解读'}
            </button>
          </form>
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </div>
  );
}

export function TrainingAdvice() {
  const [report, setReport] = useState<TrainingReport | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/training.json`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Training report unavailable');
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setReport(parseTrainingReport(data));
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);
  const summary = report?.summary;
  const ready = report?.status === 'ready' ? report : null;
  const expired = ready && trainingDate() > ready.planThrough;
  const current = summary?.current;
  return (
    <section
      className={styles.card}
      aria-labelledby="training-heading"
      data-testid="training-advice"
    >
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>RUNNING · AI</span>
          <h2 id="training-heading">训练建议</h2>
        </div>
        <span className={styles.tag}>有氧基础 · 半马完赛</span>
      </div>
      <p className={styles.muted}>
        只分析跑步 · 每周可安排约 5 次，按近期基础调整
      </p>
      {failed ? (
        <p role="alert">训练报告暂时无法加载，请刷新页面再试。</p>
      ) : !report ? (
        <p role="status">正在读取训练报告…</p>
      ) : (
        <>
          {summary && current && (
            <>
              <p className={styles.caption}>
                {current.from} — {current.through} · 最近 28 天
              </p>
              <dl className={styles.metrics}>
                <div>
                  <dt>跑量</dt>
                  <dd>
                    {current.distanceKm.toFixed(1)}
                    <small> km</small>
                  </dd>
                </div>
                <div>
                  <dt>跑步次数</dt>
                  <dd>
                    {current.runs}
                    <small> 次</small>
                  </dd>
                </div>
                <div>
                  <dt>平均配速</dt>
                  <dd>
                    {pace(current.paceSecondsPerKm)}
                    <small> /km</small>
                  </dd>
                </div>
                <div>
                  <dt>最长单次</dt>
                  <dd>
                    {current.longestRunKm.toFixed(1)}
                    <small> km</small>
                  </dd>
                </div>
              </dl>
              <p className={styles.muted}>
                前 28 天 {summary.previous.distanceKm.toFixed(1)} km /{' '}
                {summary.previous.runs} 次
                {summary.distanceChangePercent === null
                  ? ' · 无跑量变化基线'
                  : ` · 跑量 ${summary.distanceChangePercent > 0 ? '+' : ''}${summary.distanceChangePercent}%`}
                {' · '}心率记录 {current.heartRateRuns}/{current.runs} 次
              </p>
              <details className={styles.details}>
                <summary>查看统计依据与数据范围</summary>
                <p>
                  数据截止 {summary.asOf}；最近一次有效跑步：
                  {summary.latestRunDate ?? '暂无'}
                  。按活动本地日期统计，独立于地图和年份筛选。
                </p>
                <p>
                  平均配速按总时长除以总距离计算。有心率记录部分的时长加权平均：
                  {current.averageHeartRate ?? '—'} bpm；不代表所有跑步的心率。
                </p>
                {summary.excludedRuns > 0 && (
                  <p>
                    近 56 天有 {summary.excludedRuns}{' '}
                    条距离或时长为零的跑步未纳入训练估算。
                  </p>
                )}
                <div className={styles.weekTable}>
                  <table>
                    <caption>近 8 周跑步记录</caption>
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>次数</th>
                        <th>距离</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.weeks.map((week) => (
                        <tr key={week.from}>
                          <td>
                            {week.from} — {week.through}
                          </td>
                          <td>{week.runs}</td>
                          <td>{week.distanceKm.toFixed(1)} km</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
          {ready ? (
            <>
              <p className={styles.overview}>{ready.advice.overview}</p>
              <ul className={styles.notes}>
                {ready.advice.observations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className={styles.planHeader}>
                <h3>{expired ? '历史训练安排' : '接下来 7 天'}</h3>
                <span>
                  {ready.planFrom} — {ready.planThrough}
                </span>
              </div>
              {expired && (
                <p role="status" className={styles.notice}>
                  这份建议已过期，请等待新报告，不要将旧安排直接用于本周。
                </p>
              )}
              <ol className={styles.plan}>
                {ready.advice.days.map((day) => (
                  <li key={day.day} data-kind={day.kind}>
                    <div className={styles.dayLabel}>
                      <time>
                        {shiftTrainingDate(ready.planFrom, day.day - 1).slice(
                          5
                        )}
                      </time>
                      <span>
                        {day.kind === 'rest' ? '休息' : `${day.minutes} 分钟`}
                      </span>
                    </div>
                    <div>
                      <h4>{day.title}</h4>
                      <p>{day.intensity}</p>
                      <p className={styles.muted}>{day.purpose}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <h3>如何调整</h3>
              <ul className={styles.notes}>
                {ready.advice.adjustments.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <details className={styles.details}>
                <summary>建议的适用边界</summary>
                <ul className={styles.notes}>
                  {ready.advice.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
              <PrivateReport key={ready.reportId} report={ready} />
              <p className={styles.caption}>
                AI 生成于 {trainingDate(new Date(ready.generatedAt))} ·
                训练参考，请结合当天体感调整
              </p>
            </>
          ) : (
            <p className={styles.notice}>
              {report.status === 'insufficient-data'
                ? '最近 28 天没有有效跑步记录，暂时无法生成个性化训练安排。'
                : 'AI 建议尚未生成。当前展示实际跑步统计。'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
