import { normalizeActivityType, type ActivityLike } from './activity';

export type SummaryActivity = ActivityLike;

export interface SummaryDailyTotal {
  dateKey: string;
  date: Date;
  month: number;
  day: number;
  distanceKm: number;
  runs: SummaryActivity[];
}

export interface SummaryWeekTotal {
  week: number;
  distanceKm: number;
}

export interface SummaryMonthDay {
  dateKey: string;
  day: number;
  month: number;
  distanceKm: number;
  isRunDay: boolean;
}

export interface SummaryMonthColumn {
  month: number;
  label: string;
  days: SummaryMonthDay[];
}

export interface SummaryStartTimePoint {
  runId: number;
  month: number;
  day: number;
  hour: number;
  label: string;
  distanceKm: number;
}

export interface SummaryHighlight {
  distanceKm: number;
  durationSeconds: number;
  dateLabel: string;
  activity: SummaryActivity;
}

export interface SummaryDistanceBucket {
  label: string;
  count: number;
  distanceKm: number;
}

export interface YearSummary {
  year: string;
  runs: SummaryActivity[];
  totalRuns: number;
  totalDistanceKm: number;
  totalMovingTimeSeconds: number;
  runningDays: number;
  averageDistanceKm: number;
  averagePaceSeconds: number;
  longestStreakDays: number;
  longestRun: SummaryHighlight;
  longestDuration: SummaryHighlight;
  mostFrequentDistanceBucket: SummaryDistanceBucket;
  weeklyTotals: SummaryWeekTotal[];
  monthlyDayColumns: SummaryMonthColumn[];
  dailyTotals: Map<string, SummaryDailyTotal>;
  startTimePoints: SummaryStartTimePoint[];
}

const KM_IN_METERS = 1000;
const WEEKS_IN_YEAR_VIEW = 53;

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
});

const clampPrecision = (value: number, digits = 1): number => {
  return Number(value.toFixed(digits));
};

const toKilometers = (distanceMeters: number): number => {
  return distanceMeters / KM_IN_METERS;
};

const parseDate = (dateString: string): Date => {
  return new Date(dateString.replace(' ', 'T'));
};

const getDateKey = (dateString: string): string => dateString.slice(0, 10);

const getMonthLabel = (month: number): string => `${month}月`;

const getDateLabel = (date: Date): string => {
  return dateFormatter.format(date).replace('/', '月') + '日';
};

const getDayOfYear = (date: Date): number => {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - yearStart.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
};

const getWeekIndex = (date: Date): number => {
  return Math.min(
    WEEKS_IN_YEAR_VIEW,
    Math.floor((getDayOfYear(date) - 1) / 7) + 1
  );
};

const parseDurationToSeconds = (value: string): number => {
  const [hours = '0', minutes = '0', seconds = '0'] = value.split(':');
  return (
    Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds || '0')
  );
};

const getRoundedDistanceBucket = (distanceKm: number): number => {
  return Math.max(1, Math.round(distanceKm));
};

const sortByDate = (a: SummaryActivity, b: SummaryActivity): number => {
  return (
    parseDate(a.start_date_local).getTime() -
    parseDate(b.start_date_local).getTime()
  );
};

const getRunningActivitiesForYear = (
  year: string,
  activities: SummaryActivity[]
): SummaryActivity[] => {
  return activities
    .filter((activity) => normalizeActivityType(activity.type) === 'running')
    .filter((activity) => activity.start_date_local.startsWith(year))
    .sort(sortByDate);
};

export const getSummaryYears = (activities: SummaryActivity[]): string[] => {
  return [
    ...new Set(
      activities
        .filter(
          (activity) => normalizeActivityType(activity.type) === 'running'
        )
        .map((activity) => activity.start_date_local.slice(0, 4))
        .filter(Boolean)
    ),
  ].sort();
};

export const getLatestSummaryYear = (years: string[]): string | null => {
  return years.length ? years[years.length - 1] : null;
};

export const getDefaultYearSummaryYear = (
  years: string[],
  now = new Date()
): string | null => {
  if (!years.length) {
    return null;
  }

  const preferredYear = String(now.getFullYear() - 1);
  if (years.includes(preferredYear)) {
    return preferredYear;
  }

  const fallback = [...years]
    .filter((year) => year <= preferredYear)
    .sort()
    .at(-1);

  return fallback ?? getLatestSummaryYear(years);
};

const buildDailyTotals = (
  activities: SummaryActivity[]
): Map<string, SummaryDailyTotal> => {
  const dailyTotals = new Map<string, SummaryDailyTotal>();

  for (const activity of activities) {
    const dateKey = getDateKey(activity.start_date_local);
    const date = parseDate(activity.start_date_local);
    const distanceKm = toKilometers(activity.distance);
    const existing = dailyTotals.get(dateKey);

    if (existing) {
      existing.distanceKm = clampPrecision(existing.distanceKm + distanceKm, 1);
      existing.runs.push(activity);
      continue;
    }

    dailyTotals.set(dateKey, {
      dateKey,
      date,
      month: date.getMonth() + 1,
      day: date.getDate(),
      distanceKm: clampPrecision(distanceKm, 1),
      runs: [activity],
    });
  }

  return dailyTotals;
};

const buildWeeklyTotals = (
  dailyTotals: Map<string, SummaryDailyTotal>
): SummaryWeekTotal[] => {
  const totals = Array.from({ length: WEEKS_IN_YEAR_VIEW }, (_, index) => ({
    week: index + 1,
    distanceKm: 0,
  }));

  for (const daily of dailyTotals.values()) {
    const weekIndex = getWeekIndex(daily.date) - 1;
    totals[weekIndex].distanceKm = clampPrecision(
      totals[weekIndex].distanceKm + daily.distanceKm,
      1
    );
  }

  return totals;
};

const buildMonthlyDayColumns = (
  year: string,
  dailyTotals: Map<string, SummaryDailyTotal>
): SummaryMonthColumn[] => {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const daysInMonth = new Date(Number(year), month, 0).getDate();

    return {
      month,
      label: getMonthLabel(month),
      days: Array.from({ length: daysInMonth }, (_, dayIndex) => {
        const day = dayIndex + 1;
        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const daily = dailyTotals.get(dateKey);
        const distanceKm = daily?.distanceKm ?? 0;

        return {
          dateKey,
          day,
          month,
          distanceKm,
          isRunDay: distanceKm > 0,
        };
      }),
    };
  });
};

const buildStartTimePoints = (
  activities: SummaryActivity[]
): SummaryStartTimePoint[] => {
  return activities.map((activity) => {
    const date = parseDate(activity.start_date_local);
    const distanceKm = clampPrecision(toKilometers(activity.distance), 1);
    return {
      runId: activity.run_id,
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      label: `${getMonthLabel(date.getMonth() + 1)}${date.getDate()}日 · ${distanceKm.toFixed(1)} 公里 · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
      distanceKm,
    };
  });
};

const buildLongestStreakDays = (
  year: string,
  dailyTotals: Map<string, SummaryDailyTotal>
): number => {
  let longest = 0;
  let current = 0;
  const currentDate = new Date(Number(year), 0, 1);
  const yearEnd = new Date(Number(year), 11, 31);

  while (currentDate <= yearEnd) {
    const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    if ((dailyTotals.get(dateKey)?.distanceKm ?? 0) > 0) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return longest;
};

const buildMostFrequentDistanceBucket = (
  activities: SummaryActivity[]
): SummaryDistanceBucket => {
  const buckets = new Map<number, number>();

  for (const activity of activities) {
    const bucket = getRoundedDistanceBucket(toKilometers(activity.distance));
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  const [distanceKm, count] = [...buckets.entries()].sort(
    (a, b) => b[1] - a[1] || b[0] - a[0]
  )[0] ?? [0, 0];

  return {
    label: `${distanceKm}K`,
    count,
    distanceKm,
  };
};

export const buildYearSummary = (
  year: string,
  activities: SummaryActivity[]
): YearSummary | null => {
  const runs = getRunningActivitiesForYear(year, activities);

  if (!runs.length) {
    return null;
  }

  const totalDistanceKm = clampPrecision(
    runs.reduce((sum, run) => sum + toKilometers(run.distance), 0),
    1
  );
  const totalMovingTimeSeconds = runs.reduce(
    (sum, run) => sum + parseDurationToSeconds(run.moving_time),
    0
  );
  const dailyTotals = buildDailyTotals(runs);
  const longestRunActivity = [...runs].sort(
    (a, b) => b.distance - a.distance
  )[0];
  const longestDurationActivity = [...runs].sort(
    (a, b) =>
      parseDurationToSeconds(b.moving_time) -
      parseDurationToSeconds(a.moving_time)
  )[0];
  const longestRunDate = parseDate(longestRunActivity.start_date_local);
  const longestDurationDate = parseDate(
    longestDurationActivity.start_date_local
  );

  return {
    year,
    runs,
    totalRuns: runs.length,
    totalDistanceKm,
    totalMovingTimeSeconds,
    runningDays: dailyTotals.size,
    averageDistanceKm: clampPrecision(totalDistanceKm / runs.length, 1),
    averagePaceSeconds: Math.round(totalMovingTimeSeconds / totalDistanceKm),
    longestStreakDays: buildLongestStreakDays(year, dailyTotals),
    longestRun: {
      distanceKm: clampPrecision(toKilometers(longestRunActivity.distance), 1),
      durationSeconds: parseDurationToSeconds(longestRunActivity.moving_time),
      dateLabel: getDateLabel(longestRunDate),
      activity: longestRunActivity,
    },
    longestDuration: {
      distanceKm: clampPrecision(
        toKilometers(longestDurationActivity.distance),
        1
      ),
      durationSeconds: parseDurationToSeconds(
        longestDurationActivity.moving_time
      ),
      dateLabel: getDateLabel(longestDurationDate),
      activity: longestDurationActivity,
    },
    mostFrequentDistanceBucket: buildMostFrequentDistanceBucket(runs),
    weeklyTotals: buildWeeklyTotals(dailyTotals),
    monthlyDayColumns: buildMonthlyDayColumns(year, dailyTotals),
    dailyTotals,
    startTimePoints: buildStartTimePoints(runs),
  };
};

export const formatDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours <= 0) {
    return `${minutes}分`;
  }
  return `${hours}小时${minutes}分`;
};

export const formatPace = (paceSeconds: number): string => {
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = String(paceSeconds % 60).padStart(2, '0');
  return `${minutes}'${seconds}"`;
};
