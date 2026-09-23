import type { Activity } from '../core/types';
import { normalizeActivityType } from './activity';

const DAY_MS = 86_400_000;
export const trainingDate = (now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export function shiftTrainingDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(value.getTime()) ||
    value.toISOString().slice(0, 10) !== date
  )
    throw new Error('Invalid training date');
  return new Date(value.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export interface TrainingRun {
  date: string;
  distanceKm: number;
  durationSeconds: number;
  averageHeartRate: number | null;
  elevationGain: number | null;
}

export interface TrainingPeriod {
  from: string;
  through: string;
  runs: number;
  runningDays: number;
  distanceKm: number;
  durationMinutes: number;
  paceSecondsPerKm: number | null;
  longestRunKm: number;
  heartRateRuns: number;
  averageHeartRate: number | null;
}

export interface TrainingSummary {
  asOf: string;
  latestRunDate: string | null;
  current: TrainingPeriod;
  previous: TrainingPeriod;
  weeks: TrainingPeriod[];
  distanceChangePercent: number | null;
  excludedRuns: number;
  recentRuns: TrainingRun[];
}

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

function period(
  runs: TrainingRun[],
  from: string,
  through: string
): TrainingPeriod {
  const selected = runs.filter(
    (run) => run.date >= from && run.date <= through
  );
  const km = selected.reduce((total, run) => total + run.distanceKm, 0);
  const seconds = selected.reduce(
    (total, run) => total + run.durationSeconds,
    0
  );
  const withHeartRate = selected.filter((run) => run.averageHeartRate !== null);
  const heartSeconds = withHeartRate.reduce(
    (total, run) => total + run.durationSeconds,
    0
  );
  return {
    from,
    through,
    runs: selected.length,
    runningDays: new Set(selected.map((run) => run.date)).size,
    distanceKm: round(km, 2),
    durationMinutes: round(seconds / 60),
    paceSecondsPerKm: km > 0 ? Math.round(seconds / km) : null,
    longestRunKm: round(
      selected.reduce((max, run) => Math.max(max, run.distanceKm), 0),
      2
    ),
    heartRateRuns: withHeartRate.length,
    averageHeartRate:
      heartSeconds > 0
        ? Math.round(
            withHeartRate.reduce(
              (total, run) =>
                total + run.averageHeartRate! * run.durationSeconds,
              0
            ) / heartSeconds
          )
        : null,
  };
}

// Accepts the existing canonical projection; never includes identity or route fields.
export function buildTrainingSummary(
  activities: Activity[],
  asOf = trainingDate()
): TrainingSummary {
  const from = shiftTrainingDate(asOf, -55);
  let excludedRuns = 0;
  let latestRunDate: string | null = null;
  const recentRuns: TrainingRun[] = [];
  for (const activity of activities) {
    if (normalizeActivityType(activity.type) !== 'running') continue;
    const date = activity.start_date_local.slice(0, 10);
    shiftTrainingDate(date, 0);
    if (date > asOf) continue;
    const [hours, minutes, seconds] = activity.moving_time
      .split(':')
      .map(Number);
    const durationSeconds = hours * 3600 + minutes * 60 + seconds;
    if (!(activity.distance > 0) || !(durationSeconds > 0)) {
      if (date >= from) excludedRuns++;
      continue;
    }
    if (latestRunDate === null || date > latestRunDate) latestRunDate = date;
    if (date < from) continue;
    recentRuns.push({
      date,
      distanceKm: activity.distance / 1000,
      durationSeconds,
      averageHeartRate:
        Number.isFinite(activity.average_heartrate) &&
        activity.average_heartrate! > 0
          ? activity.average_heartrate
          : null,
      elevationGain:
        Number.isFinite(activity.elevation_gain) &&
        activity.elevation_gain! >= 0
          ? activity.elevation_gain
          : null,
    });
  }
  recentRuns.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.distanceKm - b.distanceKm ||
      a.durationSeconds - b.durationSeconds
  );
  const current = period(recentRuns, shiftTrainingDate(asOf, -27), asOf);
  const previous = period(recentRuns, from, shiftTrainingDate(asOf, -28));
  return {
    asOf,
    latestRunDate,
    current,
    previous,
    weeks: Array.from({ length: 8 }, (_, index) => {
      const start = shiftTrainingDate(from, index * 7);
      return period(recentRuns, start, shiftTrainingDate(start, 6));
    }),
    distanceChangePercent:
      previous.distanceKm > 0
        ? round((current.distanceKm / previous.distanceKm - 1) * 100)
        : null,
    excludedRuns,
    recentRuns,
  };
}
